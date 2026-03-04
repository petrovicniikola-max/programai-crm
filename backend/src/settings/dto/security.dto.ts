import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PatchSecurityDto {
  @ApiPropertyOptional({ description: 'JWT access TTL in minutes (TODO: apply at token issue)', default: 10080 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  jwtAccessTtlMinutes?: number;
}
