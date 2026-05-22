import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListCompaniesQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, PIB, or MB (min 2 chars recommended)' })
  @IsOptional()
  @IsString()
  search?: string;
}
