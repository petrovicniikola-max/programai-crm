import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Admin sets a new password for a user (Settings). Distinct from auth ResetPasswordDto (token + newPassword). */
export class SetUserPasswordDto {
  @ApiProperty({ minLength: 8, description: 'New password for the user' })
  @IsString()
  @MinLength(8)
  password!: string;
}
