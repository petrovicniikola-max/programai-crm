import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsEnum, IsInt, Min, IsISO8601 } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Ticket description/summary' })
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
}
