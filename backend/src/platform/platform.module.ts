import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, SettingsModule, AuthModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
