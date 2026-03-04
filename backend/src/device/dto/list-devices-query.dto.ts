import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
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
}
