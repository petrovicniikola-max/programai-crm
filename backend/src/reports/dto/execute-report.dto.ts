import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, Min, Max, IsOptional, IsArray, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class ExecuteReportDto {
  @ApiPropertyOptional({ enum: ['tickets', 'devices', 'licences'], description: 'Report type (required when executeAll is false)' })
  @IsOptional()
  @IsEnum(['tickets', 'devices', 'licences'])
  reportType?: 'tickets' | 'devices' | 'licences';

  @ApiPropertyOptional({ description: 'Report period: last N days', minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  daysBack?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional list of device IDs (only for devices report)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceIds?: string[];

  @ApiPropertyOptional({ description: 'When true, run per-email configs and send each recipient their configured report' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  executeAll?: boolean;

  @ApiPropertyOptional({ description: 'When set, run only the config at this index (0-based) and send to that email only' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  configIndex?: number;
}
