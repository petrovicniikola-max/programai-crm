import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsDateString, MinLength } from 'class-validator';

export class CreateLicenceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  productName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenceKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiProperty()
  @IsDateString()
  validTo!: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
