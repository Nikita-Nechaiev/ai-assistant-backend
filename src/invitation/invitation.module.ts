import { Module } from '@nestjs/common';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from './invitation.model';
import { CollaborationSessionModule } from 'src/collaboration-session/collaboration-session.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invitation])],
  controllers: [InvitationController],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
