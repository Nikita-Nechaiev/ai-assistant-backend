import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserCollaborationSession } from 'src/user-collaboration-session/user-collaboration-session.model';
import { Document } from 'src/document/document.model';
import { AiToolUsage } from 'src/ai-tool-usage/ai-tool-usage.model';

import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserCollaborationSession, Document, AiToolUsage])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
