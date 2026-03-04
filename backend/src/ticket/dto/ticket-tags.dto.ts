import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class TicketTagIdsDto {
  @ApiProperty({ type: [String], example: ['tagId1', 'tagId2'], description: 'Tag IDs (CUID)' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  tagIds!: string[];
}
