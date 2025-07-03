import { Module } from '@nestjs/common';
import { CollaborationSessionController } from './collaboration-session.controller';
import { CollaborationSessionService } from './collaboration-session.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationSession } from './collaboration-session.model';
import { UserCollaborationSessionModule } from 'src/user-collaboration-session/user-collaboration-session.module';
import { CollaborationSessionGateway } from './collaboration-session.gateway';
import { MessagesModule } from 'src/messages/messages.module';
import { AuthModule } from 'src/auth/auth.module';
import { SessionStateService } from 'src/common/state/session-state.service';
import { UsersModule } from 'src/user/users.module';
import { SessionContextService } from 'src/common/utils/session-context.service';
import { SessionPresenceService } from './presence/session-presence.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollaborationSession]),
    UserCollaborationSessionModule,
    MessagesModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [CollaborationSessionController],
  providers: [
    CollaborationSessionService,
    CollaborationSessionGateway,
    SessionStateService,
    SessionContextService,
    SessionPresenceService,
  ],
  exports: [CollaborationSessionService, SessionStateService],
})
export class CollaborationSessionModule {}
