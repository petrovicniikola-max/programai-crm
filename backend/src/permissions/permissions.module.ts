import { Global, Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { RolesService } from './roles.service';
import { PermissionsGuard } from './permissions.guard';
import { SettingsModule } from '../settings/settings.module';

@Global()
@Module({
  imports: [SettingsModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, RolesService, PermissionsGuard],
  exports: [PermissionsService, RolesService, PermissionsGuard],
})
export class PermissionsModule {}
