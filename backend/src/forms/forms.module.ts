import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { FormShareService } from './form-share.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [FormsController],
  providers: [FormsService, FormShareService],
  exports: [FormsService],
})
export class FormsModule {}
