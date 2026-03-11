import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateCompanyDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  addOnViewInvoicesAllDevices?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  addOnLastInvoice?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  addOnAlarmsEmail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  addOnCashInvoice?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  addOnApiAccess?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  addOnReportScheduling?: boolean;
}
