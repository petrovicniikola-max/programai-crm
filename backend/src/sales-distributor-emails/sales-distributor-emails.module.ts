import { Module } from '@nestjs/common';
import { SalesDistributorEmailsController } from './sales-distributor-emails.controller';
import { SalesDistributorEmailsService } from './sales-distributor-emails.service';

@Module({
  controllers: [SalesDistributorEmailsController],
  providers: [SalesDistributorEmailsService],
})
export class SalesDistributorEmailsModule {}

