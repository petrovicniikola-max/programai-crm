import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsObject, ValidateIf } from 'class-validator';
import { LeaveType, PaidAbsenceSubtype } from '@prisma/client';

export class CreateLeaveRequestDto {
  @ApiProperty({ enum: LeaveType })
  @IsEnum(LeaveType)
  type!: LeaveType;

  @ApiPropertyOptional({ enum: PaidAbsenceSubtype })
  @ValidateIf((o) => o.type === 'PAID_ABSENCE')
  @IsEnum(PaidAbsenceSubtype)
  paidAbsenceSubtype?: PaidAbsenceSubtype;

  @ApiProperty()
  @IsString()
  startDate!: string;

  @ApiProperty()
  @IsString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Per-day overrides keyed by YYYY-MM-DD' })
  @IsOptional()
  @IsObject()
  dayOverrides?: Record<string, number>;
}
