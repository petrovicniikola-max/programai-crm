import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryColour?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
