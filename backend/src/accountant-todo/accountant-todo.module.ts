import { Module } from '@nestjs/common';
import { AccountantTodoController } from './accountant-todo.controller';
import { AccountantTodoService } from './accountant-todo.service';
import { AccountantTodoEmailService } from './accountant-todo-email.service';
import { AccountantTodoScheduler } from './accountant-todo.scheduler';

import { TodoTeamService } from './todo-team.service';

@Module({
  controllers: [AccountantTodoController],
  providers: [
    AccountantTodoService,
    TodoTeamService,
    AccountantTodoEmailService,
    AccountantTodoScheduler,
  ],
  exports: [AccountantTodoService],
})
export class AccountantTodoModule {}
