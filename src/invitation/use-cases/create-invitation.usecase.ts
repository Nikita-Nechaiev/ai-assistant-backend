import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/user/users.service';
import { CollaborationSessionService } from 'src/collaboration-session/collaboration-session.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { InvitationService } from 'src/invitation/invitation.service';
import { InvitationStatus, NotificationStatus, Permission } from 'src/common/enums/enums';

@Injectable()
export class CreateInvitationUseCase {
  constructor(
    private readonly usersService: UsersService,
    private readonly collaborationSessionService: CollaborationSessionService,
    private readonly userCollaborationSessionService: UserCollaborationSessionService,
    private readonly invitationService: InvitationService,
  ) {}

  async execute(params: { sessionId: number; inviterId: number; receiverEmail: string; role: Permission }) {
    const { sessionId, inviterId, receiverEmail, role } = params;

    const [session, receiver, inviter] = await Promise.all([
      this.collaborationSessionService.findById(sessionId),
      this.usersService.findByEmail(receiverEmail),
      this.usersService.findById(inviterId),
    ]);

    if (!session) throw new Error(`CollaborationSession with id ${sessionId} not found`);

    if (!receiver) throw new Error(`User with email ${receiverEmail} not found`);

    if (!inviter) throw new Error('Inviter not found');

    if (await this.userCollaborationSessionService.findByUserAndSession(receiver.id, sessionId)) {
      throw new Error(`User with email ${receiverEmail} is already a participant in this session`);
    }

    if (await this.invitationService.findByReceiverAndSession(receiver.id, sessionId)) {
      throw new Error(`User with email ${receiverEmail} already has an invitation for this session`);
    }

    return this.invitationService.create({
      role,
      receiver,
      session,
      inviterEmail: inviter.email,
      invitationStatus: InvitationStatus.PENDING,
      notificationStatus: NotificationStatus.UNREAD,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }
}
