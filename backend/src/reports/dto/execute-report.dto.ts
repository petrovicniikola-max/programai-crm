import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ExecuteReportDto {
  @ApiProperty({ enum: ['tickets', 'devices', 'licences'], description: 'Report type' })
  @IsEnum(['tickets', 'devices', 'licences'])
  reportType!: 'tickets' | 'devices' | 'licences';

  @ApiProperty({ description: 'Report period: last N days', minimum: 1, maximum: 365, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  daysBack!: number;
}
