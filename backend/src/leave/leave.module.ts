import { Module } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveBalanceService } from './leave-balance.service';
import { WorkingDaysCalculator } from './working-days.calculator';
import { LeaveDocumentService } from './leave-document.service';
import { LeaveEmailService } from './leave-email.service';
import { LeaveReminderScheduler } from './leave-reminder.scheduler';

@Module({
  controllers: [LeaveController],
  providers: [
    LeaveService,
    LeaveBalanceService,
    WorkingDaysCalculator,
    LeaveDocumentService,
    LeaveEmailService,
    LeaveReminderScheduler,
  ],
  exports: [LeaveBalanceService],
})
export class LeaveModule {}
