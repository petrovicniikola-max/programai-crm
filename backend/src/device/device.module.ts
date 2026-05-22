import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { DeviceTeronImportService } from './device-teron-import.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { DistributorModule } from '../distributor/distributor.module';

@Module({
  imports: [PrismaModule, SettingsModule, DistributorModule],
  controllers: [DeviceController],
  providers: [DeviceService, DeviceTeronImportService],
  exports: [DeviceService],
})
export class DeviceModule {}
