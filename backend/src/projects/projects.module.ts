import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsController, ProjectWorkOrdersController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController, ProjectWorkOrdersController],
  providers: [ProjectsService],
})
export class ProjectsModule {}

