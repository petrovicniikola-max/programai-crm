import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min, Max, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketStatus, TicketType } from '@prisma/client';

export class TicketListQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'IN_PROGRESS', 'DONE'] })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: ['CALL', 'SUPPORT', 'SALES', 'FIELD', 'OTHER'] })
  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @ApiPropertyOptional({ description: 'Filter by assignee user ID (CUID)' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Filter by creator user ID (CUID)' })
  @IsOptional()
  @IsString()
  createdByUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Filter by key prefix (e.g. O for Outgoing Call / Prodaja)' })
  @IsOptional()
  @IsString()
  keyStartsWith?: string;

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

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
