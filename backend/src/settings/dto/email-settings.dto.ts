import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class PatchEmailSettingsDto {
  @ApiPropertyOptional({ description: 'Email adresa sa koje se šalju mailovi' })
  @IsOptional()
  @IsString()
  emailFromAddress?: string;

  @ApiPropertyOptional({ description: 'Ime koje se prikazuje kao pošiljalac' })
  @IsOptional()
  @IsString()
  emailFromName?: string;

  @ApiPropertyOptional({ enum: ['GOOGLE', 'M365'], description: 'Google (Gmail) ili Microsoft 365' })
  @IsOptional()
  @IsIn(['GOOGLE', 'M365'])
  emailProvider?: 'GOOGLE' | 'M365';

  @ApiPropertyOptional({ description: 'App password (Google) ili lozinka naloga (M365). Ostaviti prazno da se ne menja.' })
  @IsOptional()
  @IsString()
  emailPassword?: string;
}
