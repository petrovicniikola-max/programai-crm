import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment body' })
  @IsString()
  @MinLength(1)
  body!: string;
}
