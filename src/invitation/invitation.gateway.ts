import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

import { InvitationService } from 'src/invitation/invitation.service';
import { CollaborationSessionService } from 'src/collaboration-session/collaboration-session.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { UsersService } from 'src/user/users.service';

import { Roles } from 'src/common/decorators/roles.decorator';
import { SessionStateService } from 'src/collaboration-session/session-state.service';
import { InvitationStatus, NotificationStatus, Permission } from 'src/common/enums/enums';

@WebSocketGateway({
  path: '/collaboration-session-socket',
  cors: {
    origin: [process.env.FRONTEND_URL],
    credentials: true,
  },
})
export class InvitationGateway {
  @WebSocketServer() private server: Server;
  private readonly logger = new Logger('InvitationGateway');

  constructor(
    private readonly invitationService: InvitationService,
    private readonly collaborationSessionService: CollaborationSessionService,
    private readonly userCollaborationSessionService: UserCollaborationSessionService,
    private readonly userService: UsersService,
    private readonly sessionState: SessionStateService, // for session lookups
  ) {}

  // ---------------------------------------------------------------------------
  //                       DASHBOARD / NOTIFICATIONS
  // ---------------------------------------------------------------------------
  @SubscribeMessage('joinDashboard')
  async handleJoinDashboard(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('error', 'User not identified');

      return;
    }

    const roomName = `dashboard_${userId}`;

    client.join(roomName);

    this.logger.log(`User ${userId} joined dashboard room: ${roomName}`);

    const notifications = await this.invitationService.findByReceiverId(userId);

    client.emit('notifications', notifications);
  }

  @SubscribeMessage('getNotifications')
  async handleGetNotifications(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('error', 'User not identified');

      return;
    }

    const notifications = await this.invitationService.findByReceiverId(userId);

    client.emit('notifications', notifications);
  }

  @SubscribeMessage('updateNotificationStatus')
  async handleUpdateNotificationStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { invitationId: number; status: NotificationStatus },
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('error', 'User not identified');

      return;
    }

    try {
      const updatedInvitation = await this.invitationService.update(data.invitationId, {
        notificationStatus: data.status,
      });

      const sessionRoom = `session_${updatedInvitation.session.id}`;
      const dashboardRoom = `dashboard_${userId}`;

      this.server.to(sessionRoom).emit('notificationUpdated', updatedInvitation);
      this.server.to(dashboardRoom).emit('notificationUpdated', updatedInvitation);

      client.emit('notificationUpdated', updatedInvitation);
    } catch (error) {
      this.logger.error(`Failed to update notification: ${error.message}`);
      client.emit('error', 'Failed to update notification');
    }
  }

  @SubscribeMessage('deleteNotification')
  async handleDeleteNotification(@ConnectedSocket() client: Socket, @MessageBody() data: { invitationId: number }) {
    try {
      const invitation = await this.invitationService.findById(data.invitationId);

      if (!invitation) {
        client.emit('error', 'Invitation not found');

        return;
      }

      const sessionRoom = `session_${invitation.session.id}`;
      const dashboardRoom = `dashboard_${invitation.receiver.id}`;

      await this.invitationService.delete(data.invitationId);

      this.server.to(sessionRoom).emit('notificationDeleted', { invitationId: data.invitationId });
      this.server.to(dashboardRoom).emit('notificationDeleted', { invitationId: data.invitationId });

      client.emit('notificationDeleted', { invitationId: data.invitationId });

      this.logger.log(
        `Deleted notification ${data.invitationId} (Session: ${sessionRoom}, Dashboard: ${dashboardRoom})`,
      );
    } catch (error) {
      this.logger.error(`Failed to delete notification: ${error.message}`);
      client.emit('error', 'Failed to delete notification');
    }
  }

  @SubscribeMessage('acceptInvitation')
  async handleAcceptInvitation(@ConnectedSocket() client: Socket, @MessageBody() data: { invitationId: number }) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        client.emit('error', 'User not identified');

        return;
      }

      const invitation = await this.invitationService.acceptInvitation(data.invitationId);

      // Invitation used -> remove it
      await this.invitationService.delete(invitation.id);

      const sessionRoom = `session_${invitation.session.id}`;
      const dashboardRoom = `dashboard_${userId}`;

      client.emit('invitationAccepted', {
        invitationId: invitation.id,
        invitationSessionId: invitation.session.id,
      });

      this.server.to(sessionRoom).emit('notificationDeleted', { invitationId: invitation.id });
      this.server.to(dashboardRoom).emit('notificationDeleted', { invitationId: invitation.id });
    } catch (error) {
      this.logger.error(`Failed to accept invitation: ${error.message}`);
      client.emit('error', 'Failed to accept invitation');
    }
  }

  // ---------------------------------------------------------------------------
  //                              INVITATIONS
  // ---------------------------------------------------------------------------
  @SubscribeMessage('createInvitation')
  @Roles(Permission.EDIT)
  async handleCreateInvitation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { email: string; role: Permission; inviterEmail: string },
  ) {
    try {
      const { email, role } = payload;

      const sessionId = this.sessionState.socketSessionMap.get(client.id);

      if (!sessionId) {
        client.emit('error', 'Session ID not found for this socket');

        return;
      }

      const session = await this.collaborationSessionService.findById(sessionId);

      if (!session) {
        client.emit('error', `CollaborationSession with id ${sessionId} not found`);

        return;
      }

      const receiver = await this.userService.findByEmail(email);

      if (!receiver) {
        client.emit('error', `User with email ${email} not found`);

        return;
      }

      // check if user is already in session
      const isAlreadyInSession = await this.userCollaborationSessionService.findByUserAndSession(
        receiver.id,
        sessionId,
      );

      if (isAlreadyInSession) {
        client.emit('error', `User with email ${email} is already a participant in this session`);

        return;
      }

      // check if there's an existing invitation
      const existingInvitation = await this.invitationService.findByReceiverAndSession(receiver.id, sessionId);

      if (existingInvitation) {
        client.emit('error', `User with email ${email} already has an invitation for this session`);

        return;
      }

      // get who is inviting
      const inviterId = client.data.userId;
      const inviter = await this.userService.findById(inviterId);

      if (!inviter) {
        client.emit('error', 'Inviter not found');

        return;
      }

      const invitation = await this.invitationService.create({
        role,
        receiver,
        session,
        inviterEmail: inviter.email,
        invitationStatus: InvitationStatus.PENDING,
        notificationStatus: NotificationStatus.UNREAD,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      client.emit('invitationCreated', invitation);

      // Send event to the user's dashboard
      const dashboardRoom = `dashboard_${receiver.id}`;

      this.server.to(dashboardRoom).emit('newInvitation', invitation);

      // Send event to the session's room
      const sessionRoom = `session_${sessionId}`;

      this.server.to(sessionRoom).emit('newInvitation', invitation);

      this.logger.log(
        `Invitation sent to ${receiver.email} (Dashboard Room: ${dashboardRoom}, Session Room: ${sessionRoom})`,
      );
    } catch (error) {
      this.logger.error(`Error creating invitation: ${error.message}`);
      client.emit('error', 'Failed to create invitation');
    }
  }

  @SubscribeMessage('getInvitations')
  async handleGetInvitations(@ConnectedSocket() client: Socket) {
    try {
      const sessionId = this.sessionState.socketSessionMap.get(client.id);

      if (!sessionId) {
        throw new Error('Session ID not found for this socket');
      }

      const invitations = await this.invitationService.getInvitationsForSession(sessionId);

      client.emit('invitations', invitations);
    } catch (error) {
      this.logger.error(`Error fetching invitations: ${error.message}`);
      client.emit('error', 'Failed to fetch invitations');
    }
  }

  @SubscribeMessage('changeInvitationRole')
  @Roles(Permission.EDIT)
  async handleChangeInvitationRole(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { invitationId: number; newRole: Permission },
  ) {
    try {
      const { invitationId, newRole } = payload;

      // Update the invitation's role
      const updatedInvitation = await this.invitationService.changeInvitationRole(invitationId, newRole);

      // Get session and user IDs for broadcasting
      const sessionId = updatedInvitation.session.id;
      const receiverId = updatedInvitation.receiver.id;

      const sessionRoom = `session_${sessionId}`;
      const dashboardRoom = `dashboard_${receiverId}`;

      // Notify the user who triggered the change
      client.emit('invitationRoleChanged', updatedInvitation);

      // Broadcast the update to both the session and the user's dashboard
      this.server.to(sessionRoom).emit('invitationUpdated', updatedInvitation);
      this.server.to(dashboardRoom).emit('invitationUpdated', updatedInvitation);

      this.logger.log(`Invitation role changed (Session: ${sessionRoom}, Dashboard: ${dashboardRoom})`);
    } catch (error) {
      this.logger.error(`Error changing invitation role: ${error.message}`);
      client.emit('error', 'Failed to change invitation role');
    }
  }
}
