import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from './invitation.model';
import { UserCollaborationSessionModule } from 'src/user-collaboration-session/user-collaboration-session.module';
import { InvitationGateway } from './invitation.gateway';
import { UsersModule } from 'src/user/users.module';
import { CollaborationSessionModule } from 'src/collaboration-session/collaboration-session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation]),
    UserCollaborationSessionModule,
    UsersModule,
    CollaborationSessionModule,
  ],
  providers: [InvitationService, InvitationGateway],
  exports: [InvitationService],
})
export class InvitationModule {}
