import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LicenceController } from './licence.controller';
import { LicenceService } from './licence.service';
import { LicenceAlertsService } from './licence-alerts.service';
import { LicenceAlertsStubService } from './licence-alerts-stub.service';
import { LicenceAlertsProcessor } from './licence-alerts.processor';
import { LicenceAlertsScheduler } from './licence-alerts.scheduler';
import { LicenceEmailService } from './licence-email.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

const LICENCE_ALERTS_QUEUE = 'licence-alerts';

function isRedisEnabled(): boolean {
  return process.env.REDIS_ENABLED === 'true';
}

@Module({})
export class LicenceModule {
  static forRoot(): DynamicModule {
    const redisEnabled = isRedisEnabled();
    return {
      module: LicenceModule,
      imports: [
        PrismaModule,
        SettingsModule,
        ...(redisEnabled ? [BullModule.registerQueue({ name: LICENCE_ALERTS_QUEUE })] : []),
      ],
      controllers: [LicenceController],
      providers: [
        LicenceService,
        LicenceEmailService,
        ...(redisEnabled
          ? [LicenceAlertsService, LicenceAlertsProcessor, LicenceAlertsScheduler]
          : [{ provide: LicenceAlertsService, useClass: LicenceAlertsStubService }]),
      ],
      exports: [LicenceService],
    };
  }
}
