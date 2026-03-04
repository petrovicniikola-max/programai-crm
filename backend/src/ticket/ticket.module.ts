import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { TicketCommentService } from './ticket-comment.service';
import { TicketTaskService } from './ticket-task.service';
import { TagModule } from '../tag/tag.module';

@Module({
  imports: [TagModule],
  controllers: [TicketController],
  providers: [TicketService, TicketCommentService, TicketTaskService],
  exports: [TicketService],
})
export class TicketModule {}
