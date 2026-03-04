import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: 'Order number (default 0)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderNo?: number;
}
