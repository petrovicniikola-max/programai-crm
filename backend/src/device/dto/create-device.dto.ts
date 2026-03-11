import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { DeviceStatus } from '@prisma/client';

export class CreateDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNo?: string;

  @ApiPropertyOptional({ enum: DeviceStatus })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  testDevice?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dpu?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sufEnvironment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eFakturaEnvironment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountSync?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  teronPaymentGateway?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mdmProfileName?: string;
}
