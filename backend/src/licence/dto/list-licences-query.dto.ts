import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsDateString, Min, Max, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class ListLicencesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Limit to licences for these device IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceIds?: string[];

  @ApiPropertyOptional({ enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;


  @ApiPropertyOptional({ description: 'Licences expiring within N days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiringInDays?: number;

  @ApiPropertyOptional({ description: 'Licences expiring from this many days from today (inclusive)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  expiringFromDays?: number;

  @ApiPropertyOptional({ description: 'Licences expiring up to this many days from today (inclusive)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  expiringToDays?: number;

  @ApiPropertyOptional({ description: 'From date (ISO) for validTo range' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ description: 'To date (ISO) for validTo range' })
  @IsOptional()
  @IsDateString()
  validTo?: string;
}
