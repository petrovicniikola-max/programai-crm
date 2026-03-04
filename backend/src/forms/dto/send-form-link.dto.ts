import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, MaxLength } from 'class-validator';

export class SendFormLinkDto {
  @ApiProperty({ example: 'recipient@example.com' })
  @IsEmail()
  toEmail!: string;

  @ApiPropertyOptional({ description: 'Optional personal message in the email' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
