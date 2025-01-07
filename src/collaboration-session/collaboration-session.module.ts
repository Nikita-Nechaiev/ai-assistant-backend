import { Module } from '@nestjs/common';
import { CollaborationSessionController } from './collaboration-session.controller';
import { CollaborationSessionService } from './collaboration-session.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationSession } from './collaboration-session.model';
import { UsersModule } from 'src/user/users.module';
import { InvitationModule } from 'src/invitation/invitation.module';
import { DocumentModule } from 'src/document/document.module';
import { UserCollaborationSessionModule } from 'src/user-collaboration-session/user-collaboration-session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollaborationSession]),
    UsersModule,
    DocumentModule,
    UserCollaborationSessionModule,
    InvitationModule,
  ],
  controllers: [CollaborationSessionController],
  providers: [CollaborationSessionService],
  exports: [CollaborationSessionService],
})
export class CollaborationSessionModule {}
