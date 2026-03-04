import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsInt, Min } from 'class-validator';

export class PatchNotificationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailFromName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailFromAddress?: string;

  @ApiPropertyOptional({ example: [30, 14, 7, 1] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  notificationsDaysBefore?: number[];
}
