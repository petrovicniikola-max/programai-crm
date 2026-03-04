import {
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnswerItemDto {
  @ApiProperty()
  @IsString()
  questionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  valueText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  valueNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  valueJson?: unknown;
}

export class SubmitFormDto {
  @ApiPropertyOptional()
  @IsOptional()
  metadata?: {
    leadName?: string;
    leadEmail?: string;
    leadPhone?: string;
    companyName?: string;
    [key: string]: unknown;
  };

  @ApiProperty({ type: [AnswerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];
}
