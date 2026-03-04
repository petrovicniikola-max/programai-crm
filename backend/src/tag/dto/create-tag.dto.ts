import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ example: 'licenca' })
  @IsString()
  @MinLength(1)
  name!: string;
}
