import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

  @ApiPropertyOptional({ example: 1500, description: 'Cena nove licence u dinarima (bonus za jedan mesec)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Cena mora biti pozitivan ceo broj.' })
  @Min(1, { message: 'Cena mora biti pozitivan ceo broj.' })
  @Max(100_000_000, { message: 'Cena mora biti pozitivan ceo broj.' })
  bonusAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
