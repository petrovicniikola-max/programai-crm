import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class RenewLicenceDto {
  @ApiProperty({ description: 'New validTo date (ISO)' })
  @IsDateString()
  validTo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
