import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SoldDevicesController } from './sold-devices.controller';
import { SoldDevicesService } from './sold-devices.service';

@Module({
  imports: [PrismaModule],
  controllers: [SoldDevicesController],
  providers: [SoldDevicesService],
})
export class SoldDevicesModule {}
