import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketStatus, TicketType } from '@prisma/client';
import { TicketPriority } from '@prisma/client';

export class PatchTicketSettingsDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'IN_PROGRESS', 'DONE'] })
  @IsOptional()
  @IsEnum(TicketStatus)
  defaultStatus?: TicketStatus;

  @ApiPropertyOptional({ enum: ['CALL', 'SUPPORT', 'SALES', 'FIELD', 'OTHER'] })
  @IsOptional()
  @IsEnum(TicketType)
  defaultType?: TicketType;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsOptional()
  @IsEnum(TicketPriority)
  defaultPriority?: TicketPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  autoInProgressOnAssign?: boolean;
}
