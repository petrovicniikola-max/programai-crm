import { PartialType } from '@nestjs/swagger';
import { CreateTodoTeamDto } from './create-todo-team.dto';

export class UpdateTodoTeamDto extends PartialType(CreateTodoTeamDto) {}
