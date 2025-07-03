import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { InvitationService } from 'src/invitation/invitation.service';
import { SessionContextService } from 'src/common/utils/session-context.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { NotificationStatus, Permission } from 'src/common/enums/enums';
import { dashboardRoom, sessionRoom } from 'src/common/utils/room.util';
import { CreateInvitationUseCase } from './use-cases/create-invitation.usecase';

@WebSocketGateway({
  path: '/collaboration-session-socket',
  cors: { origin: [process.env.FRONTEND_URL], credentials: true },
})
export class InvitationGateway {
  @WebSocketServer() private server: Server;
  private readonly logger = new Logger(InvitationGateway.name);

  constructor(
    private readonly invitationService: InvitationService,
    private readonly createInvitationUseCase: CreateInvitationUseCase,
    private readonly sessionContextService: SessionContextService,
  ) {}

  @SubscribeMessage('joinDashboard')
  async joinDashboard(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('error', 'User not identified');

      return;
    }

    client.join(dashboardRoom(userId));

    const notifications = await this.invitationService.findByReceiverId(userId);

    client.emit('notifications', notifications);
  }

  @SubscribeMessage('updateNotificationStatus')
  async updateNotificationStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { invitationId: number; status: NotificationStatus },
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        client.emit('error', 'User not identified');

        return;
      }

      const updatedInvitation = await this.invitationService.update(data.invitationId, {
        notificationStatus: data.status,
      });

      this.server.to(sessionRoom(updatedInvitation.session.id)).emit('invitationUpdated', updatedInvitation);
      this.server.to(dashboardRoom(userId)).emit('invitationUpdated', updatedInvitation);
    } catch (error) {
      this.logger.error(error.message);
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('deleteNotification')
  async deleteNotification(@ConnectedSocket() client: Socket, @MessageBody() data: { invitationId: number }) {
    try {
      const invitation = await this.invitationService.findById(data.invitationId);

      if (!invitation) {
        client.emit('error', 'Invitation not found');

        return;
      }

      await this.invitationService.delete(data.invitationId);
      this.server
        .to(sessionRoom(invitation.session.id))
        .emit('notificationDeleted', { invitationId: data.invitationId });
      this.server
        .to(dashboardRoom(invitation.receiver.id))
        .emit('notificationDeleted', { invitationId: data.invitationId });
    } catch (error) {
      this.logger.error(error.message);
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('acceptInvitation')
  async acceptInvitation(@ConnectedSocket() client: Socket, @MessageBody() data: { invitationId: number }) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        client.emit('error', 'User not identified');

        return;
      }

      const invitation = await this.invitationService.acceptInvitation(data.invitationId);

      client.emit('invitationAccepted', { invitationId: invitation.id, invitationSessionId: invitation.session.id });

      await this.invitationService.delete(invitation.id);
      this.server.to(sessionRoom(invitation.session.id)).emit('notificationDeleted', { invitationId: invitation.id });
    } catch (error) {
      this.logger.error(error.message);
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('createInvitation')
  @Roles(Permission.EDIT)
  async createInvitation(@ConnectedSocket() client: Socket, @MessageBody() data: { email: string; role: Permission }) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);
      const invitation = await this.createInvitationUseCase.execute({
        sessionId,
        inviterId: client.data.userId,
        receiverEmail: data.email,
        role: data.role,
      });

      this.server.to(dashboardRoom(invitation.receiver.id)).emit('newInvitation', invitation);
      this.server.to(sessionRoom(sessionId)).emit('newInvitation', invitation);
    } catch (error) {
      this.logger.error(error.message);
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('getInvitations')
  async getInvitations(@ConnectedSocket() client: Socket) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);
      const invitations = await this.invitationService.getInvitationsForSession(sessionId);

      client.emit('invitations', invitations);
    } catch (error) {
      this.logger.error(error.message);
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('changeInvitationRole')
  @Roles(Permission.EDIT)
  async changeInvitationRole(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { invitationId: number; newRole: Permission },
  ) {
    try {
      const updatedInvitation = await this.invitationService.changeInvitationRole(data.invitationId, data.newRole);

      this.server.to(sessionRoom(updatedInvitation.session.id)).emit('invitationUpdated', updatedInvitation);
      this.server.to(dashboardRoom(updatedInvitation.receiver.id)).emit('invitationUpdated', updatedInvitation);
    } catch (error) {
      this.logger.error(error.message);
      client.emit('error', error.message);
    }
  }
}
