import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateTravelOrderDto {
  @ApiProperty({ example: '2026-08-03' })
  @IsString()
  startDate!: string;

  @ApiProperty({ example: '2026-08-06' })
  @IsString()
  endDate!: string;

  @ApiProperty({ example: 'Kopaonik' })
  @IsString()
  @MinLength(2)
  destination!: string;

  @ApiProperty({ example: 'JP Skijališta Srbije Kopaonik' })
  @IsString()
  @MinLength(2)
  hostName!: string;

  @ApiProperty({ example: 'Provera rada sistema na ski-centru Kopaonik' })
  @IsString()
  @MinLength(2)
  task!: string;

  @ApiProperty({ example: 3200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dailyRate!: number;

  @ApiProperty({ example: 'Nikolu Petrovića', description: 'Ime u padežu za odluku' })
  @IsString()
  @MinLength(3)
  decisionName!: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsString()
  decisionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Opcioni mail knjigovođe' })
  @IsOptional()
  @IsEmail()
  accountingEmail?: string;
}
