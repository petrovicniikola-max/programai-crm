import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class WorkOrderLineDto {
  @ApiProperty({ example: '10056595' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ description: 'Quantity (hours for man/hour articles)', example: 5 })
  @IsNumber()
  @Min(0.01)
  quantity!: number;
}

export class CreateWorkOrderDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ProjectWorkOrderType })
  @IsEnum(ProjectWorkOrderType)
  type!: ProjectWorkOrderType;

  @ApiPropertyOptional({ description: 'Contract / serial number used for later invoicing' })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiPropertyOptional({ description: 'Requested works' })
  @IsOptional()
  @IsString()
  requestedWork?: string;

  @ApiPropertyOptional({ description: 'Performed works' })
  @IsOptional()
  @IsString()
  performedWork?: string;

  @ApiPropertyOptional({
    description: 'Decimal hours. If lines are provided, hours are computed as sum of quantities.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hours?: number;

  @ApiPropertyOptional({
    description: 'Date string: dd/mm/yyyy, dd.mm.yyyy, dd-mm-yyyy, or ISO date. If omitted, uses current date.',
  })
  @IsOptional()
  @IsString()
  workDate?: string;

  @ApiPropertyOptional({ description: 'If true, sets workDate to today (local server date)' })
  @IsOptional()
  today?: boolean;

  @ApiProperty({ type: [WorkOrderLineDto], description: 'Article lines (1–2, unique codes)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => WorkOrderLineDto)
  lines!: WorkOrderLineDto[];
}
