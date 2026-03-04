import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class UpdateTenantSettingsDto {
  @ApiPropertyOptional({ description: 'Arbitrary settings key-value' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
