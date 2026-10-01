import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProjectWorkOrderType } from '@prisma/client';
import { WorkOrderLineDto } from './create-work-order.dto';

export class UpdateWorkOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProjectWorkOrderType })
  @IsOptional()
  @IsEnum(ProjectWorkOrderType)
  type?: ProjectWorkOrderType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestedWork?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  performedWork?: string;

  @ApiPropertyOptional({ description: 'Decimal hours, e.g. 1.5. Overridden when lines are provided.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hours?: number;

  @ApiPropertyOptional({ description: 'Date string: dd/mm/yyyy, dd.mm.yyyy, dd-mm-yyyy, or ISO date.' })
  @IsOptional()
  @IsString()
  workDate?: string;

  @ApiPropertyOptional({ type: [WorkOrderLineDto], description: 'Replace article lines (1–2, unique codes)' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => WorkOrderLineDto)
  lines?: WorkOrderLineDto[];
}
