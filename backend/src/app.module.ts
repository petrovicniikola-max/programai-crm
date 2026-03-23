import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { CompanyModule } from './company/company.module';
import { ContactModule } from './contact/contact.module';
import { TicketModule } from './ticket/ticket.module';
import { TagModule } from './tag/tag.module';
import { SettingsModule } from './settings/settings.module';
import { FormsModule } from './forms/forms.module';
import { DeviceModule } from './device/device.module';
import { LicenceModule } from './licence/licence.module';
import { PlatformModule } from './platform/platform.module';
import { PublicModule } from './public/public.module';
import { ReportsModule } from './reports/reports.module';
import { SalesImportModule } from './sales-import/sales-import.module';

const redisEnabled = process.env.REDIS_ENABLED === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'short', ttl: 60000, limit: 10 }]),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    ...(redisEnabled
      ? [
          BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
              connection: {
                host: config.get<string>('REDIS_HOST', 'localhost'),
                port: config.get<number>('REDIS_PORT', 6379),
              },
            }),
            inject: [ConfigService],
          }),
        ]
      : []),
    PrismaModule,
    AuthModule,
    TenantModule,
    CompanyModule,
    ContactModule,
    TicketModule,
    TagModule,
    SettingsModule,
    FormsModule,
    DeviceModule,
    LicenceModule.forRoot(),
    PlatformModule,
    PublicModule,
    ReportsModule,
    SalesImportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}




