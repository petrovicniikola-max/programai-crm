import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsArray, IsString, IsEmail, IsEnum, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export type TicketStatusFilter = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface ReportEmailConfigItem {
  email: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'yearly';
  reportType: 'tickets' | 'devices' | 'licences' | 'sales';
  /** For devices/licences: filter by company */
  companyId?: string;
  /** For devices: limit to these device IDs. For licences: limit to licences for these device IDs */
  deviceIds?: string[];
  /** For tickets: filter by status(es) – open, in progress, closed */
  ticketStatuses?: TicketStatusFilter[];
  /** For tickets: filter by assignee (user ID or 'unassigned') */
  assigneeId?: string;
  /** For sales: filter by creator user ID */
  salesCreatedByUserId?: string;
  /** For sales: filter by contact method PHONE | EMAIL */
  salesContactMethod?: 'PHONE' | 'EMAIL';
  /** Time of day HH:mm when report should be sent (e.g. 08:00) */
  scheduleTime?: string;
  /** For weekly: day of week 0=Sunday … 6=Saturday */
  scheduleDayOfWeek?: number;
  /** For monthly: 1st of month (previous month) or last day of current month at 23:59 */
  scheduleMonthOption?: '1st_previous' | 'last_current';
  /** For yearly: current year or previous year */
  scheduleYearOption?: 'current' | 'previous';
}

export class ReportEmailConfigItemDto {
  @ApiProperty({ example: 'admin@firma.rs' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['daily', 'weekly', 'monthly', 'yearly'] })
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'])
  schedule!: 'daily' | 'weekly' | 'monthly' | 'yearly';

  @ApiProperty({ enum: ['tickets', 'devices', 'licences', 'sales'] })
  @IsEnum(['tickets', 'devices', 'licences', 'sales'])
  reportType!: 'tickets' | 'devices' | 'licences' | 'sales';

  @ApiPropertyOptional({ description: 'For sales: filter by creator user ID' })
  @IsOptional()
  @IsString()
  salesCreatedByUserId?: string;

  @ApiPropertyOptional({ enum: ['PHONE', 'EMAIL'], description: 'For sales: način kontakta' })
  @IsOptional()
  @IsIn(['PHONE', 'EMAIL'])
  salesContactMethod?: 'PHONE' | 'EMAIL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceIds?: string[];

  @ApiPropertyOptional({ enum: ['OPEN', 'IN_PROGRESS', 'DONE'], isArray: true, description: 'For tickets: filter by status' })
  @IsOptional()
  @IsArray()
  @IsEnum(['OPEN', 'IN_PROGRESS', 'DONE'], { each: true })
  ticketStatuses?: ('OPEN' | 'IN_PROGRESS' | 'DONE')[];

  @ApiPropertyOptional({ description: 'For tickets: filter by assignee (user ID or unassigned)' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ example: '08:00', description: 'Time of day HH:mm' })
  @IsOptional()
  @IsString()
  scheduleTime?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 6, description: 'Weekly: day of week 0=Sun … 6=Sat' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(6)
  scheduleDayOfWeek?: number;

  @ApiPropertyOptional({ enum: ['1st_previous', 'last_current'], description: 'Monthly: 1st for previous month or last day of current' })
  @IsOptional()
  @IsIn(['1st_previous', 'last_current'])
  scheduleMonthOption?: '1st_previous' | 'last_current';

  @ApiPropertyOptional({ enum: ['current', 'previous'], description: 'Yearly: which year' })
  @IsOptional()
  @IsIn(['current', 'previous'])
  scheduleYearOption?: 'current' | 'previous';
}

export class AlertsConfigResponseDto {
  notificationsDaysBefore?: number[];
  reportSchedule?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  reportEmails?: string[];
  reportEmailConfigs?: ReportEmailConfigItem[];
}

export class PatchAlertsConfigDto {
  @ApiPropertyOptional({ enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] })
  @IsOptional()
  @IsIn(['none', 'daily', 'weekly', 'monthly', 'yearly'])
  reportSchedule?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

  @ApiPropertyOptional({ type: [String], description: 'Email addresses for scheduled report (legacy)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reportEmails?: string[];

  @ApiPropertyOptional({ type: [ReportEmailConfigItemDto], description: 'Per-email config: period, report type, company, devices' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportEmailConfigItemDto)
  reportEmailConfigs?: ReportEmailConfigItemDto[];
}
