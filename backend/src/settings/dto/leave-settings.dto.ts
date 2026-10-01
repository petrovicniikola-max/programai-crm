import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, IsArray, IsBoolean, IsNumber } from 'class-validator';

export class PatchLeaveSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultApproverId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  minAnnualDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  personalDaysPerYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAbsenceMaxDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  seniorityBonusTable?: { minYears: number; maxYears: number | null; bonusDays: number }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyAddress?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyCity?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reminderAfterMonthDay?: string;

  @ApiPropertyOptional({
    description: 'Emails that receive Word decision on annual leave approval',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  decisionNotificationEmails?: string[];
}

export class CreateLeaveAdjustmentDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty({ enum: ['ANNUAL', 'PERSONAL'] })
  @IsString()
  type!: 'ANNUAL' | 'PERSONAL';

  @ApiProperty({ description: 'Positive to add, negative to subtract' })
  @IsNumber()
  amount!: number;

  @ApiProperty()
  @IsString()
  occurredOn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class SetPreviousLeaveDto {
  @ApiProperty({ description: 'Available days from previous fiscal year (use by 30 June)' })
  @IsNumber()
  @Min(0)
  availableDays!: number;
}

export class CreateHolidayDto {
  @ApiProperty()
  @IsString()
  date!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
