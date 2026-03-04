import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class LicenceEmailService {
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
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

  async sendLicenceExpiryAlert(params: {
    to: string[];
    fromName: string | null;
    fromAddress: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (params.to.length === 0) {
      return { success: false, error: 'No recipients' };
    }
    const from = params.fromName
      ? `"${params.fromName.replace(/"/g, '')}" <${params.fromAddress}>`
      : params.fromAddress;

    if (!this.transporter) {
      console.log('[LicenceAlert] (no SMTP) would send to', params.to.join(', '), params.subject);
      return { success: true };
    }

    try {
      await this.transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return { success: true };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return { success: false, error: err };
    }
  }
}
