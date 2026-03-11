import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const SMTP_GOOGLE = { host: 'smtp.gmail.com', port: 587, secure: false };
const SMTP_M365 = { host: 'smtp.office365.com', port: 587, secure: false };

@Injectable()
export class FormShareService {
  private transporter: Transporter | null = null;
  private etherealTransporter: Promise<Transporter> | null = null;

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

  /** Build transporter from tenant Settings → Slanje mailova (Google / M365). */
  private transporterFromTenantSettings(settings: {
    emailFromAddress: string | null;
    emailProvider: string | null;
    emailPassword: string | null;
  }): Transporter | null {
    const { emailFromAddress, emailProvider, emailPassword } = settings;
    if (!emailFromAddress || !emailProvider || !emailPassword) return null;
    const cfg = emailProvider === 'M365' ? SMTP_M365 : emailProvider === 'GOOGLE' ? SMTP_GOOGLE : null;
    if (!cfg) return null;
    return nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: emailFromAddress, pass: emailPassword },
    });
  }

  private async getEtherealTransporter(): Promise<Transporter> {
    if (this.etherealTransporter) return this.etherealTransporter;
    this.etherealTransporter = (async () => {
      const account = await nodemailer.createTestAccount();
      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
    })();
    return this.etherealTransporter;
  }

  async sendFormLink(params: {
    tenantId: string;
    formId: string;
    formTitle: string;
    toEmail: string;
    message?: string;
  }): Promise<{ sent: boolean; error?: string; previewUrl?: string }> {
    const baseUrl =
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('APP_URL') ||
      'http://localhost:3001';
    const formLink = `${baseUrl.replace(/\/$/, '')}/forms/${params.formId}/responses`;

    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId: params.tenantId },
    });
    const fromName = settings?.emailFromName ?? null;
    const fromAddress = settings?.emailFromAddress ?? this.config.get<string>('SMTP_FROM') ?? 'noreply@localhost';
    const from = fromName ? `"${fromName.replace(/"/g, '')}" <${fromAddress}>` : fromAddress;

    const subject = `Forma: ${params.formTitle}`;
    const custom = params.message?.trim() ? `\n\n${params.message.trim()}\n\n` : '\n\n';
    const text = `Pozdrav,\n\nOvde je link ka formi "${params.formTitle}":\n${formLink}${custom}— ProgramAI`;
    const html = `<p>Pozdrav,</p><p>Ovde je link ka formi <strong>${escapeHtml(params.formTitle)}</strong>:</p><p><a href="${escapeHtml(formLink)}">${escapeHtml(formLink)}</a></p>${params.message?.trim() ? `<p>${escapeHtml(params.message.trim())}</p>` : ''}<p>— ProgramAI</p>`;

    const tenantTransport = settings ? this.transporterFromTenantSettings(settings) : null;
    const transport = tenantTransport ?? this.transporter ?? (await this.getEtherealTransporter());
    const isEthereal = !tenantTransport && !this.transporter;

    try {
      const info = await transport.sendMail({
        from,
        to: params.toEmail,
        subject,
        text,
        html,
      });
      const url = isEthereal ? nodemailer.getTestMessageUrl(info) : undefined;
      const previewUrl = typeof url === 'string' ? url : undefined;
      if (previewUrl) {
        console.log('[FormShare] (Ethereal test) Preview mail:', previewUrl);
      }
      return { sent: true, previewUrl };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return { sent: false, error: err };
    }
  }

  /** Send report email with CSV attachment to one or more recipients. */
  async sendReportEmail(params: {
    tenantId: string;
    to: string[];
    subject: string;
    text: string;
    attachment: { filename: string; content: string };
  }): Promise<{ sent: number; failed: number; errors?: string[] }> {
    if (params.to.length === 0) return { sent: 0, failed: 0 };

    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId: params.tenantId },
    });
    const fromName = settings?.emailFromName ?? null;
    const fromAddress =
      settings?.emailFromAddress ?? this.config.get<string>('SMTP_FROM') ?? 'noreply@localhost';
    const from = fromName ? `"${fromName.replace(/"/g, '')}" <${fromAddress}>` : fromAddress;

    const tenantTransport = settings ? this.transporterFromTenantSettings(settings) : null;
    const transport = tenantTransport ?? this.transporter ?? (await this.getEtherealTransporter());

    let sent = 0;
    const errors: string[] = [];
    for (const toEmail of params.to) {
      try {
        await transport.sendMail({
          from,
          to: toEmail,
          subject: params.subject,
          text: params.text,
          attachments: [
            {
              filename: params.attachment.filename,
              content: params.attachment.content,
            },
          ],
        });
        sent++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { sent, failed: params.to.length - sent, errors: errors.length ? errors : undefined };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
