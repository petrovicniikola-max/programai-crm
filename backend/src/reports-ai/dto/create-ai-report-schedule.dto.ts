import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class CreateAiReportScheduleDto {
  @ApiProperty({ description: 'Lista email adresa' })
  @IsArray()
  @IsString({ each: true })
  recipients!: string[];

  @ApiProperty({
    description:
      'DAILY | EVERY_7_DAYS | EVERY_15_DAYS | MONTHLY_FIRST_DAY | MONTHLY_LAST_DAY',
  })
  @IsString()
  scheduleType!:
    | 'DAILY'
    | 'EVERY_7_DAYS'
    | 'EVERY_15_DAYS'
    | 'MONTHLY_FIRST_DAY'
    | 'MONTHLY_LAST_DAY';

  @ApiProperty({ description: 'HH:mm', required: false, default: '08:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  scheduleTime?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

