import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class PatchStatusDto {
  @ApiProperty({ enum: ['OPEN', 'IN_PROGRESS', 'DONE'] })
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}
