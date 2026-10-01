import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class PatchUiTextsDto {
  @ApiPropertyOptional({
    description: 'Map of UI text overrides, e.g. { "devices.description": "..." }',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  texts?: Record<string, string>;
}

