import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsEnum, IsInt, Min, IsISO8601, IsArray, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketStatus, TicketType } from '@prisma/client';

export class CreateTicketDto {
  @ApiPropertyOptional({ description: 'Unique key (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: 'Ticket description/summary (Opis prijave)' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['OPEN', 'IN_PROGRESS', 'DONE'] })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: ['CALL', 'SUPPORT', 'SALES', 'FIELD', 'OTHER'] })
  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @ApiPropertyOptional({ description: 'Company ID (CUID)' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Contact ID (CUID)' })
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Assignee ID (CUID)' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'User who created the ticket (Ticket napravio); defaults to current user' })
  @IsOptional()
  @IsString()
  createdByUserId?: string;

  @ApiPropertyOptional({ description: 'When the call occurred (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  callOccurredAt?: string;

  @ApiPropertyOptional({ description: 'Call duration in minutes', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  callDurationMinutes?: number;

  @ApiPropertyOptional({ enum: ['PHONE', 'EMAIL'], description: 'Način kontakta (za odlazne pozive)' })
  @IsOptional()
  @IsString()
  @IsIn(['PHONE', 'EMAIL'])
  contactMethod?: 'PHONE' | 'EMAIL';

  @ApiPropertyOptional({ description: 'Broj kontaktiranih korisnika', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  contactsContactedCount?: number;

  @ApiPropertyOptional({ description: 'Ko je prijavio (ime firme ili korisnika)' })
  @IsOptional()
  @IsString()
  reportedBy?: string;

  @ApiPropertyOptional({ description: 'Put i angažovanje – niz redova teksta' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  putIAngazovanje?: string[];

  @ApiPropertyOptional({ description: 'Tok prijave' })
  @IsOptional()
  @IsString()
  tokPrijave?: string;

  @ApiPropertyOptional({ description: 'Zaključak' })
  @IsOptional()
  @IsString()
  zakljucak?: string;

  @ApiPropertyOptional({ description: 'Potpis ovlašćenog lica' })
  @IsOptional()
  @IsString()
  potpisOvlascenogLica?: string;

  @ApiPropertyOptional({ description: 'Datum na formi (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  ticketDate?: string;
}
