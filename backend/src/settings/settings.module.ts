import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsBrandingService } from './settings-branding.service';
import { SettingsUsersService } from './settings-users.service';
import { SettingsTicketSettingsService } from './settings-ticket-settings.service';
import { SettingsNotificationsService } from './settings-notifications.service';
import { SettingsSecurityService } from './settings-security.service';
import { SettingsEmailService } from './settings-email.service';
import { SettingsExportService } from './settings-export.service';
import { AuditLogService } from './audit-log.service';
import { TagModule } from '../tag/tag.module';

@Module({
  imports: [TagModule],
  controllers: [SettingsController],
  providers: [
    SettingsBrandingService,
    SettingsUsersService,
    SettingsTicketSettingsService,
    SettingsNotificationsService,
    SettingsSecurityService,
    SettingsEmailService,
    SettingsExportService,
    AuditLogService,
  ],
  exports: [AuditLogService],
})
export class SettingsModule {}
