import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  months!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
