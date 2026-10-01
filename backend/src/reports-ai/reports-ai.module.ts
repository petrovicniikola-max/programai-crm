import { Module } from '@nestjs/common';
import { ReportsAiController } from './reports-ai.controller';
import { ReportsAiService } from './reports-ai.service';
import { ReportsAiScheduler } from './reports-ai.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { FormsModule } from '../forms/forms.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, FormsModule, ConfigModule],
  controllers: [ReportsAiController],
  providers: [ReportsAiService, ReportsAiScheduler],
})
export class ReportsAiModule {}

