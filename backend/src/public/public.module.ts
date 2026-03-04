import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PublicController } from './public.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [PublicController],
})
export class PublicModule {}

