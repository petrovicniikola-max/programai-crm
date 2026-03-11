import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsArray, IsString } from 'class-validator';

export class AlertsConfigResponseDto {
  notificationsDaysBefore?: number[];
  reportSchedule?: 'none' | 'daily' | 'weekly';
  reportEmails?: string[];
}

export class PatchAlertsConfigDto {
  @ApiPropertyOptional({ enum: ['none', 'daily', 'weekly'] })
  @IsOptional()
  @IsIn(['none', 'daily', 'weekly'])
  reportSchedule?: 'none' | 'daily' | 'weekly';

  @ApiPropertyOptional({ type: [String], description: 'Email addresses for scheduled report' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reportEmails?: string[];
}
