import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { LicenceEmailService } from './licence-email.service';
import type { LicenceAlertJobPayload } from './licence-alerts.service';

const LICENCE_ALERTS_QUEUE = 'licence-alerts';

@Processor(LICENCE_ALERTS_QUEUE)
export class LicenceAlertsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: LicenceEmailService,
  ) {
    super();
  }

  async process(job: Job<LicenceAlertJobPayload, void, string>): Promise<void> {
    const payload = job.data;
    const triggerDate = new Date(payload.triggerDate + 'T00:00:00.000Z');
    const recipientEmails = payload.recipientEmails.filter((e) => e?.trim());

    if (recipientEmails.length === 0) {
      await this.prisma.licenceNotificationLog.create({
        data: {
          tenantId: payload.tenantId,
          licenceId: payload.licenceId,
          daysBefore: payload.daysBefore,
          triggerDate,
          recipient: null,
          status: 'SKIPPED',
          error: 'No recipient emails',
        },
      });
      return;
    }

    const subject = `Licence expiring in ${payload.daysBefore} day(s): ${payload.productName}`;
    const validToStr = new Date(payload.validTo).toLocaleDateString();
    const text = `Company: ${payload.companyName}\nProduct: ${payload.productName}\nValid to: ${validToStr}\nThis licence expires in ${payload.daysBefore} day(s).\n\n${payload.emailSignature ?? ''}`;
    const html = `<p>Company: <strong>${escapeHtml(payload.companyName)}</strong></p><p>Product: <strong>${escapeHtml(payload.productName)}</strong></p><p>Valid to: <strong>${validToStr}</strong></p><p>This licence expires in <strong>${payload.daysBefore}</strong> day(s).</p>${payload.emailSignature ? `<hr/><div>${escapeHtml(payload.emailSignature)}</div>` : ''}`;

    const fromAddress = payload.fromAddress?.trim() || 'noreply@localhost';
    const result = await this.emailService.sendLicenceExpiryAlert({
      to: recipientEmails,
      fromName: payload.fromName,
      fromAddress,
      subject,
      text,
      html,
    });

    await this.prisma.licenceNotificationLog.create({
      data: {
        tenantId: payload.tenantId,
        licenceId: payload.licenceId,
        daysBefore: payload.daysBefore,
        triggerDate,
        recipient: recipientEmails.join(', '),
        status: result.success ? 'SENT' : 'FAILED',
        error: result.error ?? null,
      },
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
