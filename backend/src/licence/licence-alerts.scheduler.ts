import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LicenceAlertsService } from './licence-alerts.service';

@Injectable()
export class LicenceAlertsScheduler {
  constructor(private readonly alertsService: LicenceAlertsService) {}

  @Cron('0 9 * * *', { timeZone: 'Europe/Belgrade' })
  async handleDailyScan() {
    await this.alertsService.runScheduled();
  }
}
