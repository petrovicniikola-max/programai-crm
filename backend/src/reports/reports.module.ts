import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FormsModule } from '../forms/forms.module';
import { TicketModule } from '../ticket/ticket.module';
import { DeviceModule } from '../device/device.module';
import { LicenceModule } from '../licence/licence.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, FormsModule, TicketModule, DeviceModule, LicenceModule.forRoot()],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
