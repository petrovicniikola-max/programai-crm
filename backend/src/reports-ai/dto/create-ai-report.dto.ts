import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateAiReportDto {
  @ApiProperty({ description: 'Slobodan tekst koji opisuje izveštaj' })
  @IsString()
  @MinLength(3)
  promptText!: string;
}

