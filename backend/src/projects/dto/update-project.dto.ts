import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ description: 'Project start date (ISO string)' })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Project end date (ISO string) or null/empty to clear' })
  @IsOptional()
  endDate?: string | null;

  @ApiPropertyOptional({ description: 'Assigned portal users (ids) - replaces assignment list' })
  @IsOptional()
  @IsArray()
  assignedUserIds?: string[];

  @ApiPropertyOptional({ description: 'Client company id (from /clients)' })
  @IsOptional()
  @IsString()
  companyId?: string | null;

  @ApiPropertyOptional({ description: 'Distributor id' })
  @IsOptional()
  @IsString()
  distributorId?: string | null;
}

