import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { AccountantTodoService } from './accountant-todo.service';
import { belgradeTodayParts, isSameBelgradeDay } from './accountant-todo-date.utils';

const SMTP_GOOGLE = { host: 'smtp.gmail.com', port: 587, secure: false };
const SMTP_M365 = { host: 'smtp.office365.com', port: 587, secure: false };

@Injectable()
export class AccountantTodoEmailService {
  private transporter: Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly todos: AccountantTodoService,
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

  private formatDate(d: Date | null): string {
    if (!d) return '—';
    return d.toISOString().slice(0, 10);
  }

  async sendTeamDigest(tenantId: string, teamId: string) {
    const team = await this.prisma.todoTeam.findFirst({
      where: { id: teamId, tenantId, isActive: true },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, displayName: true, isActive: true },
            },
          },
        },
      },
    });
    if (!team) return { sent: false, reason: 'no-team' };

    const now = new Date();
    const { year, month, day } = belgradeTodayParts(now);
    const sentOn = new Date(Date.UTC(year, month - 1, day));

    const already = await this.prisma.todoTeamNotificationLog.findUnique({
      where: { teamId_sentOn: { teamId: team.id, sentOn } },
    });
    if (already) return { sent: false, reason: 'already-sent' };

    const memberUsers = team.members.map((m) => m.user).filter((u) => u.isActive);
    const memberIds = memberUsers.map((u) => u.id);
    const todos = await this.todos.getActiveTodosForUsers(tenantId, memberIds);
    if (!todos.length) return { sent: false, reason: 'no-todos' };

    const extra = Array.isArray(team.extraRecipients)
      ? (team.extraRecipients as string[])
      : [];
    const recipients = [
      ...new Set([
        ...memberUsers.map((u) => u.email),
        ...extra.map(String).filter(Boolean),
      ]),
    ];
    if (!recipients.length) return { sent: false, reason: 'no-recipients' };

    const transport = await this.getTransporter(tenantId);
    if (!transport) return { sent: false, reason: 'no-smtp' };

    const from =
      (await this.prisma.tenantSettings.findUnique({ where: { tenantId } }))
        ?.emailFromAddress ?? 'noreply@crm.local';

    const lines = todos.map((t) => {
      const owner = t.user.displayName ?? t.user.email;
      const due = t.dueDate ? this.formatDate(t.dueDate) : 'bez roka';
      const flag =
        t.dueDate && !isSameBelgradeDay(t.dueDate, now) && t.dueDate < now
          ? ' [PROŠAO ROK]'
          : t.dueDate && isSameBelgradeDay(t.dueDate, now)
            ? ' [DANAS]'
            : '';
      return `- ${owner}: ${t.title} (rok: ${due})${flag}`;
    });

    const text = [
      `Dnevni TO DO pregled — tim: ${team.name}`,
      '',
      ...lines,
      '',
      '— CRM ESTUAR',
    ].join('\n');

    await transport.sendMail({
      from,
      to: recipients.join(', '),
      subject: `TO DO [${team.name}] — ${todos.length} aktivnih taskova`,
      text,
    });

    await this.prisma.todoTeamNotificationLog.create({
      data: { tenantId, teamId: team.id, sentOn },
    });

    return { sent: true, count: todos.length, recipients: recipients.length };
  }
}
