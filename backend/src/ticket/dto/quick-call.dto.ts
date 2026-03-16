import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsInt, Min, IsISO8601, IsIn, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class QuickCallDto {
  @ApiPropertyOptional({ example: '+38165483215', description: 'Phone number (optional when Centrala is used)' })
  @ValidateIf((o) => o.phone !== undefined && o.phone !== null && String(o.phone).trim() !== '')
  @IsString()
  @MinLength(6, { message: 'Phone must be at least 6 characters when provided' })
  phone?: string;

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
    description: 'Quick Call: tip razgovora (Support/Prodaja). Ako nije poslato, ticket.type = CALL.',
    enum: ['SUPPORT', 'SALES'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['SUPPORT', 'SALES'])
  conversationKind?: 'SUPPORT' | 'SALES';

  @ApiPropertyOptional({
    description: 'Outgoing Call: način kontakta PHONE ili EMAIL.',
    enum: ['PHONE', 'EMAIL'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['PHONE', 'EMAIL'])
  contactMethod?: 'PHONE' | 'EMAIL';

  @ApiPropertyOptional({
    description: 'Outgoing Call: koliko korisnika je kontaktirano.',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  contactsContactedCount?: number;
}
