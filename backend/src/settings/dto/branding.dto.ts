import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class PatchBrandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

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
  @IsString()
  emailSignature?: string;
}
