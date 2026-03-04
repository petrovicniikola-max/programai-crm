import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength } from 'class-validator';

export class ImpersonateDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @ApiPropertyOptional({ description: 'If set, act as this user; otherwise platform admin in context of tenant' })
  @IsOptional()
  @IsString()
  userId?: string;
}
