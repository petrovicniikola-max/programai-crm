import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TravelOrdersController } from './travel-orders.controller';
import { TravelOrdersService } from './travel-orders.service';
import { TravelOrderDocumentService } from './travel-order-document.service';
import { TravelOrderEmailService } from './travel-order-email.service';

@Module({
  imports: [PrismaModule],
  controllers: [TravelOrdersController],
  providers: [TravelOrdersService, TravelOrderDocumentService, TravelOrderEmailService],
})
export class TravelOrdersModule {}
