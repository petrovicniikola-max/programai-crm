import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsInt, Min, IsISO8601, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QuickCallDto {
  @ApiProperty({ example: '+38165483215', description: 'Phone number (required)' })
  @IsString()
  @MinLength(6)
  phone!: string;

  @ApiPropertyOptional({ example: 'Petar Perić' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: 'Company name – find or create and link contact to it' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: 'Company PIB (tax ID) – for lookup or when creating from company name' })
  @IsOptional()
  @IsString()
  pib?: string;

  @ApiPropertyOptional({ description: 'Company MB (matični broj) – when creating from company name' })
  @IsOptional()
  @IsString()
  mb?: string;

  @ApiPropertyOptional({ description: 'Company ID (CUID) – use existing company' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ example: 'Zanima ga: produženje licence + dodatni štampač' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: 'Assignee user ID (CUID)' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'When the call occurred (ISO 8601); default NOW if omitted' })
  @IsOptional()
  @IsISO8601()
  callOccurredAt?: string;

  @ApiPropertyOptional({ description: 'Call duration in minutes', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  callDurationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Classification of conversation (for reporting/UX). SUPPORT or SALES. If omitted, ticket.type stays CALL.',
    enum: ['SUPPORT', 'SALES'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['SUPPORT', 'SALES'])
  conversationKind?: 'SUPPORT' | 'SALES';
}
