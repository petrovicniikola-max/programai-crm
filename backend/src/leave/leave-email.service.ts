import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { parseDecisionNotificationEmails } from './leave-decision.constants';

const SMTP_GOOGLE = { host: 'smtp.gmail.com', port: 587, secure: false };
const SMTP_M365 = { host: 'smtp.office365.com', port: 587, secure: false };

@Injectable()
export class LeaveEmailService {
  private transporter: Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (host && port) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
    }
  }

  private async getTransporter(tenantId: string): Promise<Transporter | null> {
    if (this.transporter) return this.transporter;
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings?.emailFromAddress || !settings.emailProvider || !settings.emailPassword) {
      return null;
    }
    const cfg =
      settings.emailProvider === 'M365'
        ? SMTP_M365
        : settings.emailProvider === 'GOOGLE'
          ? SMTP_GOOGLE
          : null;
    if (!cfg) return null;
    return nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: settings.emailFromAddress, pass: settings.emailPassword },
    });
  }

  private frontendUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('APP_URL') ||
      'http://localhost:3001'
    ).replace(/\/$/, '');
  }

  async notifyApprover(
    tenantId: string,
    request: {
      id: string;
      user: { displayName: string | null; email: string };
      approver: { email: string; displayName: string | null } | null;
      type: string;
      startDate: Date;
      endDate: Date;
    },
  ) {
    if (!request.approver?.email) return;
    const transport = await this.getTransporter(tenantId);
    if (!transport) return;

    const from =
      (await this.prisma.tenantSettings.findUnique({ where: { tenantId } }))?.emailFromAddress ??
      'noreply@crm.local';
    const name = request.user.displayName ?? request.user.email;
    const link = `${this.frontendUrl()}/leave`;

    await transport.sendMail({
      from,
      to: request.approver.email,
      subject: `Novi zahtev za odsustvo — ${name}`,
      text: `${name} je podneo zahtev za odsustvo (${request.type}) od ${request.startDate.toISOString().slice(0, 10)} do ${request.endDate.toISOString().slice(0, 10)}.\n\nPregled: ${link}`,
    });
  }

  async notifyApproverCancelled(
    tenantId: string,
    request: {
      user: { displayName: string | null; email: string };
      approver: { email: string; displayName: string | null } | null;
      type: string;
      startDate: Date;
      endDate: Date;
    },
  ) {
    if (!request.approver?.email) return;
    const transport = await this.getTransporter(tenantId);
    if (!transport) return;

    const from =
      (await this.prisma.tenantSettings.findUnique({ where: { tenantId } }))?.emailFromAddress ??
      'noreply@crm.local';
    const name = request.user.displayName ?? request.user.email;

    await transport.sendMail({
      from,
      to: request.approver.email,
      subject: `Zahtev za odsustvo je otkazan — ${name}`,
      text: `${name} je otkazao zahtev za odsustvo (${request.type}) od ${request.startDate.toISOString().slice(0, 10)} do ${request.endDate.toISOString().slice(0, 10)}.`,
    });
  }

  async sendDecisionDocument(
    tenantId: string,
    request: {
      user: { displayName: string | null; email: string };
      decisionNumber: string | null;
      startDate: Date;
      endDate: Date;
      totalWorkingDays: number;
    },
    attachment: { filename: string; content: Buffer },
  ) {
    const transport = await this.getTransporter(tenantId);
    if (!transport) {
      console.warn('[Leave] SMTP not configured — decision document not emailed');
      return;
    }

    const leaveSettings = await this.prisma.tenantLeaveSettings.findUnique({ where: { tenantId } });
    const recipients = parseDecisionNotificationEmails(leaveSettings?.decisionNotificationEmails);
    const from =
      (await this.prisma.tenantSettings.findUnique({ where: { tenantId } }))?.emailFromAddress ??
      'noreply@crm.local';

    const name = request.user.displayName ?? request.user.email;
    const period = `${request.startDate.toISOString().slice(0, 10)} – ${request.endDate.toISOString().slice(0, 10)}`;
    const subject = `Rešenje o godišnjem odmoru — ${name}${request.decisionNumber ? ` (${request.decisionNumber})` : ''}`;
    const text = `U prilogu je rešenje o godišnjem odmoru za ${name}.\n\nBroj: ${request.decisionNumber ?? '—'}\nPeriod: ${period}\nRadni dani: ${request.totalWorkingDays}`;

    await transport.sendMail({
      from,
      to: recipients.join(', '),
      subject,
      text,
      attachments: [
        {
          filename: attachment.filename,
          content: attachment.content,
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ],
    });
  }

  async notifyEmployeeDecision(
    tenantId: string,
    request: {
      user: { email: string; displayName: string | null };
      type: string;
      decisionNote: string | null;
    },
    outcome: 'approved' | 'rejected',
  ) {
    const transport = await this.getTransporter(tenantId);
    if (!transport) return;

    const from =
      (await this.prisma.tenantSettings.findUnique({ where: { tenantId } }))?.emailFromAddress ??
      'noreply@crm.local';
    const subject =
      outcome === 'approved'
        ? 'Zahtev za odsustvo je odobren'
        : 'Zahtev za odsustvo je odbijen';
    const note = request.decisionNote ? `\nNapomena: ${request.decisionNote}` : '';

    await transport.sendMail({
      from,
      to: request.user.email,
      subject,
      text: `Vaš zahtev za odsustvo (${request.type}) je ${outcome === 'approved' ? 'odobren' : 'odbijen'}.${note}`,
    });
  }

  async sendExpiryReminders(tenantId: string) {
    const settings = await this.prisma.tenantLeaveSettings.findUnique({ where: { tenantId } });
    if (!settings) return;

    const now = new Date();
    const june30 = new Date(now.getFullYear(), 5, 30);
    const daysUntil = Math.ceil((june30.getTime() - now.getTime()) / (86400000));
    if (daysUntil > 30 || daysUntil < 0) return;

    const entitlements = await this.prisma.leaveEntitlement.findMany({
      where: {
        tenantId,
        kind: 'PREVIOUS',
        expiresAt: { gte: now },
      },
      include: { user: true },
    });

    const transport = await this.getTransporter(tenantId);
    if (!transport) return;
    const from =
      (await this.prisma.tenantSettings.findUnique({ where: { tenantId } }))?.emailFromAddress ??
      'noreply@crm.local';

    for (const e of entitlements) {
      const avail = e.totalDays - e.usedDays;
      if (avail <= 0 || !e.user.email) continue;
      await transport.sendMail({
        from,
        to: e.user.email,
        subject: 'Podsetnik: iskoristite godišnji odmor do 30.06.',
        text: `Imate ${avail} neiskorišćenih dana godišnjeg odmora iz prethodnog ciklusa. Iskoristite ih do 30.06.`,
      });
    }
  }
}
