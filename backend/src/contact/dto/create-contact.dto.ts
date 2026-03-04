import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsArray } from 'class-validator';

export class CreateContactDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ description: 'Company ID (CUID)' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ type: [String], example: ['+38165483215'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phones?: string[];
}
