import { Module } from '@nestjs/common';
import { DistributorController } from './distributor.controller';
import { DistributorService } from './distributor.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DistributorController],
  providers: [DistributorService],
  exports: [DistributorService],
})
export class DistributorModule {}
