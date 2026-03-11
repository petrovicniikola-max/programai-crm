import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsISO8601 } from 'class-validator';
import { TicketStatus, TicketType } from '@prisma/client';

export class TicketsExportQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'IN_PROGRESS', 'DONE'] })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: ['CALL', 'SUPPORT', 'SALES', 'FIELD', 'OTHER'] })
  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Created at from (ISO date)' })
  @IsOptional()
  @IsISO8601()
  createdAtFrom?: string;

  @ApiPropertyOptional({ description: 'Created at to (ISO date)' })
  @IsOptional()
  @IsISO8601()
  createdAtTo?: string;

  @ApiPropertyOptional({ description: 'Updated at from (ISO date)' })
  @IsOptional()
  @IsISO8601()
  updatedAtFrom?: string;

  @ApiPropertyOptional({ description: 'Updated at to (ISO date)' })
  @IsOptional()
  @IsISO8601()
  updatedAtTo?: string;
}
