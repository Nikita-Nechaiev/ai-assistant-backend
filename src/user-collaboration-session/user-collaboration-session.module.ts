import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCollaborationSession } from './user-collaboration-session.model';
import { UserCollaborationSessionService } from './user-collaboration-session.service';
import { UserCollaborationSessionController } from './user-collaboration-session.controller';
import { UsersModule } from 'src/user/users.module';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([UserCollaborationSession]),
  ],
  controllers: [UserCollaborationSessionController],
  providers: [UserCollaborationSessionService],
  exports: [UserCollaborationSessionService],
})
export class UserCollaborationSessionModule {}
