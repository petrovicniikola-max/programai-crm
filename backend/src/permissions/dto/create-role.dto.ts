import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'OFFICE_MANAGER' })
  @IsString()
  @MinLength(2)
  @Matches(/^[A-Za-z0-9_]+$/, { message: 'Slug može sadržati slova, brojeve i _' })
  slug!: string;

  @ApiProperty({ example: 'Office Manager' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class RolePermissionItemDto {
  @ApiProperty()
  @IsString()
  resourceKey!: string;

  @ApiProperty()
  @IsBoolean()
  canView!: boolean;

  @ApiProperty()
  @IsBoolean()
  canEdit!: boolean;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [RolePermissionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionItemDto)
  permissions!: RolePermissionItemDto[];
}
