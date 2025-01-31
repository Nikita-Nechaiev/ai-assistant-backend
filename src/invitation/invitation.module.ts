import { Module } from '@nestjs/common';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from './invitation.model';
import { UserCollaborationSessionModule } from 'src/user-collaboration-session/user-collaboration-session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation]),
    UserCollaborationSessionModule,
  ],
  controllers: [InvitationController],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
