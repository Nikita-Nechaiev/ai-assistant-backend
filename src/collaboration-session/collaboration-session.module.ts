import { Module } from '@nestjs/common';
import { CollaborationSessionController } from './collaboration-session.controller';
import { CollaborationSessionService } from './collaboration-session.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationSession } from './collaboration-session.model';
import { UsersModule } from 'src/user/users.module';
import { InvitationModule } from 'src/invitation/invitation.module';
import { DocumentModule } from 'src/document/document.module';
import { UserCollaborationSessionModule } from 'src/user-collaboration-session/user-collaboration-session.module';
import { CollaborationSessionGateway } from './collaboration-session.gateway';
import { MessagesModule } from 'src/messages/messages.module';
import { AuthModule } from 'src/auth/auth.module';
import { AiToolUsageModule } from 'src/ai-tool-usage/ai-tool-usage.module';
import { VersionModule } from 'src/version/version.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollaborationSession]),
    UsersModule,
    DocumentModule,
    UserCollaborationSessionModule,
    InvitationModule,
    MessagesModule,
    AuthModule,
    VersionModule,
    AiToolUsageModule,
  ],
  controllers: [CollaborationSessionController],
  providers: [CollaborationSessionService, CollaborationSessionGateway],
  exports: [CollaborationSessionService],
})
export class CollaborationSessionModule {}
