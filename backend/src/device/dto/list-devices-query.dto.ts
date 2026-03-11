import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsISO8601 } from 'class-validator';
import { DeviceStatus } from '@prisma/client';

export class ListDevicesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'RETIRED'] })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Created at from (ISO date)' })
  @IsOptional()
  @IsISO8601()
  createdAtFrom?: string;

  @ApiPropertyOptional({ description: 'Created at to (ISO date)' })
  @IsOptional()
  @IsISO8601()
  createdAtTo?: string;
}
