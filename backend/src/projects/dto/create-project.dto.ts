import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ description: 'Project start date (ISO string)' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ description: 'Project end date (ISO string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ description: 'Assigned portal users (ids)' })
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

