import { IsArray, ValidateNested, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QuestionOrderItemDto {
  @ApiProperty()
  @IsString()
  questionId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderNo: number;
}

export class ReorderQuestionsDto {
  @ApiProperty({ type: [QuestionOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOrderItemDto)
  order: QuestionOrderItemDto[];
}
