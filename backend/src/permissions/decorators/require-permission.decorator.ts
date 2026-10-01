import { SetMetadata } from '@nestjs/common';
import type { PermissionAction } from '../permission-catalog';

export const PERMISSION_KEY = 'permission';

export const RequirePermission = (resource: string, action: PermissionAction = 'view') =>
  SetMetadata(PERMISSION_KEY, { resource, action });
