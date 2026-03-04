import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListLicencesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

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

  @ApiPropertyOptional({ description: 'From date (ISO) for validTo range' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ description: 'To date (ISO) for validTo range' })
  @IsOptional()
  @IsDateString()
  validTo?: string;
}
