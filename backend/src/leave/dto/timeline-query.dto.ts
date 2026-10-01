import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class LeaveTimelineQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional({ enum: ['company', 'my'] })
  @IsOptional()
  @IsIn(['company', 'my'])
  scope?: 'company' | 'my';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}
