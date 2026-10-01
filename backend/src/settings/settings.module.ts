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
import { SettingsUiTextsService } from './settings-ui-texts.service';
import { SettingsLeaveService } from './settings-leave.service';
import { SettingsLeaveBalancesService } from './settings-leave-balances.service';
import { LeaveModule } from '../leave/leave.module';

@Module({
  imports: [TagModule, LeaveModule],
  controllers: [SettingsController],
  providers: [
    SettingsBrandingService,
    SettingsUsersService,
    SettingsLeaveService,
    SettingsLeaveBalancesService,
    SettingsTicketSettingsService,
    SettingsNotificationsService,
    SettingsSecurityService,
    SettingsEmailService,
    SettingsExportService,
    SettingsUiTextsService,
    AuditLogService,
  ],
  exports: [AuditLogService],
})
export class SettingsModule {}
