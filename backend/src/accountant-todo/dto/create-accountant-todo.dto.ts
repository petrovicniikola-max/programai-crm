import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAccountantTodoDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;
}
