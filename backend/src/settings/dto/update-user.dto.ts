import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EmploymentContractType, UserRole } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ enum: ['SUPER_ADMIN', 'SUPPORT', 'SALES', 'USER', 'ACCOUNTANT'] })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'RBAC role id (preferred over role enum)' })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Receive licence expiry notification emails' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  receiveLicenceExpiryEmails?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employmentDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leaveApproverId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitle?: string | null;

  @ApiPropertyOptional({ enum: EmploymentContractType })
  @IsOptional()
  @IsEnum(EmploymentContractType)
  employmentContractType?: EmploymentContractType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractEndDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  totalWorkExperienceYears?: number | null;
}
