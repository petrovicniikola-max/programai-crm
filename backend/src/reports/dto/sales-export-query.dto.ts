import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsISO8601, IsIn } from 'class-validator';

export class SalesExportQueryDto {
  @ApiPropertyOptional({ description: 'Created at from (ISO date/time)' })
  @IsOptional()
  @IsISO8601()
  createdAtFrom?: string;

  @ApiPropertyOptional({ description: 'Created at to (ISO date/time)' })
  @IsOptional()
  @IsISO8601()
  createdAtTo?: string;

  @ApiPropertyOptional({ description: 'Filter by creator user ID' })
  @IsOptional()
  @IsString()
  createdByUserId?: string;

  @ApiPropertyOptional({ enum: ['PHONE', 'EMAIL'], description: 'Način kontakta' })
  @IsOptional()
  @IsIn(['PHONE', 'EMAIL'])
  contactMethod?: 'PHONE' | 'EMAIL';
}
