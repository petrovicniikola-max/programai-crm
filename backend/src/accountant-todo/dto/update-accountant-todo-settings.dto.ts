import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateAccountantTodoSettingsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraRecipients?: string[];

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  reminderTime?: string;
}
