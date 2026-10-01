import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { formatSrDate } from './travel-order.util';

const SMTP_GOOGLE = { host: 'smtp.gmail.com', port: 587, secure: false };
const SMTP_M365 = { host: 'smtp.office365.com', port: 587, secure: false };

export interface TravelMailInput {
  number: string;
  employeeName: string;
  destination: string;
  hostName: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  dailyRate: number;
  totalAmount: number;
  totalInWords: string;
  userEmail: string;
  accountingEmail?: string | null;
  nalog: Buffer;
  odluka: Buffer;
  nalogName: string;
  odlukaName: string;
}

@Injectable()
export class TravelOrderEmailService {
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
        secure: Number(port) === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
    }
  }

  async send(
    tenantId: string,
    order: TravelMailInput,
  ): Promise<{ userSent: boolean; accountingSent: boolean; message?: string }> {
    const transport = await this.getTransporter(tenantId);
    if (!transport) {
      return { userSent: false, accountingSent: false, message: 'Pošta nije podešena. Dokumenti su sačuvani u CRM-u.' };
    }
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    const from = settings?.emailFromAddress || this.config.get<string>('SMTP_FROM') || 'noreply@crm.local';
    const text = [
      `Putni nalog ${order.number}`,
      `${order.employeeName}`,
      `${formatSrDate(order.startDate)} – ${formatSrDate(order.endDate)}`,
      `${order.destination}, ${order.hostName}`,
      `${order.dayCount} dnevnica × ${order.dailyRate} din = ${order.totalAmount} din`,
      order.totalInWords,
      '',
      'U prilogu su putni nalog i odluka.',
    ].join('\n');
    const attachments = [
      { filename: order.nalogName, content: order.nalog },
      { filename: order.odlukaName, content: order.odluka },
    ];
    const subject = `Putni nalog ${order.number} — ${order.destination}`;

    let userSent = false;
    let accountingSent = false;
    const errors: string[] = [];
    try {
      await transport.sendMail({ from, to: order.userEmail, subject, text, attachments });
      userSent = true;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Mail korisniku nije poslat');
    }
    const accounting = order.accountingEmail?.trim();
    if (accounting) {
      try {
        await transport.sendMail({
          from,
          to: accounting,
          subject: `${subject} (za realizaciju)`,
          text,
          attachments,
        });
        accountingSent = true;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Mail knjigovođi nije poslat');
      }
    }
    return {
      userSent,
      accountingSent,
      message: errors.length ? errors.join(' ') : undefined,
    };
  }

  private async getTransporter(tenantId: string): Promise<Transporter | null> {
    if (this.transporter) return this.transporter;
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings?.emailFromAddress || !settings.emailProvider || !settings.emailPassword) return null;
    const cfg =
      settings.emailProvider === 'M365' ? SMTP_M365 : settings.emailProvider === 'GOOGLE' ? SMTP_GOOGLE : null;
    if (!cfg) return null;
    return nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: settings.emailFromAddress, pass: settings.emailPassword },
    });
  }
}
