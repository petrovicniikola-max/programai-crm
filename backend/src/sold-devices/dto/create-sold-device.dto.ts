import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const SOLD_DEVICE_MONTHS = [3, 6, 12, 24] as const;

export class CreateSoldDeviceDto {
  @ApiProperty({ example: 'SN-001234' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  serialNo!: string;

  @ApiPropertyOptional({ example: 'Kasa 1' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ example: 'Teron POS' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  licenceName!: string;

  @ApiProperty({ example: 12, enum: SOLD_DEVICE_MONTHS })
  @Type(() => Number)
  @IsInt()
  @IsIn(SOLD_DEVICE_MONTHS)
  months!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
