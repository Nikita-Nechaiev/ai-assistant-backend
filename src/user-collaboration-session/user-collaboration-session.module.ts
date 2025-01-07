import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCollaborationSession } from './user-collaboration-session.model';
import { UserCollaborationSessionService } from './user-collaboration-session.service';
import { UserCollaborationSessionController } from './user-collaboration-session.controller';
import { UsersModule } from 'src/user/users.module';
import { CollaborationSessionModule } from 'src/collaboration-session/collaboration-session.module';
import { AnalyticsSummaryModule } from 'src/analytics-summary/analytics-summary.module';

@Module({
  imports: [
    UsersModule,
    AnalyticsSummaryModule,
    TypeOrmModule.forFeature([UserCollaborationSession]),
  ],
  controllers: [UserCollaborationSessionController],
  providers: [UserCollaborationSessionService],
  exports: [UserCollaborationSessionService],
})
export class UserCollaborationSessionModule {}
