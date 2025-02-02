import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { parse } from 'cookie';
import { verify } from 'jsonwebtoken';
import {
  Logger,
  UnauthorizedException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';

// Сервисы и модели
import { CollaborationSessionService } from './collaboration-session.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { DocumentService } from 'src/document/document.service';
import { InvitationService } from 'src/invitation/invitation.service';
import {
  InvitationStatus,
  NotificationStatus,
} from 'src/invitation/invitation.model';
import { Permission } from 'src/user-collaboration-session/user-collaboration-session.model';
import { UsersService } from 'src/user/users.service';
import { MessagesService } from 'src/messages/messages.service';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/user/user.model';
import { Document } from 'src/document/document.model';
import { Roles } from 'src/common/decorators/roles.decorator';

@WebSocketGateway({
  path: '/collaboration-session-socket',
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true,
  },
})
export class CollaborationSessionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private server: Server;
  private readonly logger = new Logger('CollaborationSessionGateway');

  private onlineUsers: Map<
    number,
    { sessionId: number; startTime: number; socketIds: Set<string> }
  > = new Map();

  private socketSessionMap = new Map<string, number>();

  constructor(
    private readonly userCollaborationSessionService: UserCollaborationSessionService,
    private readonly documentService: DocumentService,
    private readonly invitationService: InvitationService,
    private readonly userService: UsersService,
    private readonly collaborationSessionService: CollaborationSessionService,
    private readonly messagesService: MessagesService,
    private readonly authService: AuthService,
  ) {}

  afterInit(server: Server) {
    this.logger.log(
      'WebSocket Gateway initialized at /collaboration-session-socket',
    );
    server.on('connection', () => {});
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const cookiesHeader = client.handshake.headers.cookie;
      if (!cookiesHeader) {
        throw new UnauthorizedException('No cookies found in request');
      }
      const cookies = parse(cookiesHeader);
      let accessToken = cookies['accessToken'];
      let refreshToken = cookies['refreshToken'];

      if (!accessToken) {
        throw new UnauthorizedException('Access token not found in cookies');
      }
      if (!refreshToken) {
        throw new UnauthorizedException('Refresh token not found in cookies');
      }

      let decoded: any;
      try {
        decoded = verify(accessToken, process.env.JWT_ACCESS_SECRET);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          const { accessToken: newAccessToken, newRefreshToken } =
            await this.authService.refresh(refreshToken);
          accessToken = newAccessToken;
          refreshToken = newRefreshToken;
          decoded = verify(accessToken, process.env.JWT_ACCESS_SECRET);

          // Обновим cookies в handshake
          client.handshake.headers.cookie = `accessToken=${accessToken}; refreshToken=${refreshToken}`;
          client.emit('refreshedTokens', {
            accessToken,
            refreshToken: newRefreshToken,
          });
        } else {
          throw new UnauthorizedException(error.message);
        }
      }

      if (!decoded?.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      client.data.userId = Number(decoded.sub);

      // ----> Сразу добавляем в dashboard-комнату
      const roomName = `dashboard_${client.data.userId}`;
      client.join(roomName);
      this.logger.log(`User ${client.data.userId} auto-joined: ${roomName}`);
    } catch (error) {
      this.logger.error(`Unauthorized connection attempt: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const sessionId = this.socketSessionMap.get(client.id);

    if (userId) {
      const userData = this.onlineUsers.get(userId);
      if (userData) {
        // Удаляем этот сокет из множества
        userData.socketIds.delete(client.id);

        // Если сокетов не осталось — пользователь окончательно вышел
        if (userData.socketIds.size === 0) {
          const timeSpentSeconds = (Date.now() - userData.startTime) / 1000;

          // Обновляем в БД время нахождения
          await this.userCollaborationSessionService.updateTimeSpent(
            userId,
            sessionId,
            timeSpentSeconds,
          );

          // Обновляем lastInteracted на дату выхода (текущее время)
          await this.userCollaborationSessionService.updateLastInteracted(
            userId,
            sessionId,
            new Date(),
          );

          this.logger.log(
            `User ${userId} spent ${timeSpentSeconds}s in the session (${sessionId}).`,
          );

          // Уведомляем сессию, что пользователь вышел
          this.server.to(`session_${sessionId}`).emit('userLeft', { userId });

          // Удаляем запись о пользователе
          this.onlineUsers.delete(userId);
        }
      }
    }

    // Удаляем сам сокет из socketSessionMap
    this.socketSessionMap.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ====================== ЛОГИКA ДЛЯ DASHBOARD / УВЕДОМЛЕНИЙ ====================== //
  @SubscribeMessage('joinDashboard')
  async handleJoinDashboard(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', 'User not identified');
      return;
    }

    // Create a personal room for the user
    const roomName = `dashboard_${userId}`;
    client.join(roomName);

    this.logger.log(`User ${userId} joined dashboard room: ${roomName}`);

    // Fetch notifications through the service
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

    // Fetch notifications through the service
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
      // Call the service method to update the notification status
      const updatedInvitation = await this.invitationService.update(
        data.invitationId,
        {
          notificationStatus: data.status,
        },
      );

      const sessionRoom = `session_${updatedInvitation.session.id}`;
      const dashboardRoom = `dashboard_${userId}`;

      this.server
        .to(sessionRoom)
        .emit('notificationUpdated', updatedInvitation);
      this.server
        .to(dashboardRoom)
        .emit('notificationUpdated', updatedInvitation);

      client.emit('notificationUpdated', updatedInvitation);
    } catch (error) {
      this.logger.error(`Failed to update notification: ${error.message}`);
      client.emit('error', 'Failed to update notification');
    }
  }

  @SubscribeMessage('deleteNotification')
  async handleDeleteNotification(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { invitationId: number },
  ) {
    try {
      const invitation = await this.invitationService.findById(
        data.invitationId,
      );
      if (!invitation) {
        client.emit('error', 'Invitation not found');
        return;
      }

      const sessionRoom = `session_${invitation.session.id}`;
      const dashboardRoom = `dashboard_${invitation.receiver.id}`;

      await this.invitationService.delete(data.invitationId);

      this.server
        .to(sessionRoom)
        .emit('notificationDeleted', { invitationId: data.invitationId });
      this.server
        .to(dashboardRoom)
        .emit('notificationDeleted', { invitationId: data.invitationId });

      // Also emit to the client who triggered it
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
  async handleAcceptInvitation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { invitationId: number },
  ) {
    try {
      const userId = client.data.userId;
      if (!userId) {
        client.emit('error', 'User not identified');
        return;
      }

      const invitation = await this.invitationService.acceptInvitation(
        data.invitationId,
      );
      await this.invitationService.delete(invitation.id);

      const sessionRoom = `session_${invitation.session.id}`;
      const dashboardRoom = `dashboard_${userId}`;

      // Notify user and broadcast event to all relevant rooms
      client.emit('invitationAccepted', {
        invitationId: invitation.id,
        sessionId: invitation.session.id,
      });

      this.server
        .to(sessionRoom)
        .emit('notificationDeleted', { invitationId: invitation.id });
      this.server
        .to(dashboardRoom)
        .emit('notificationDeleted', { invitationId: invitation.id });
    } catch (error) {
      this.logger.error(`Failed to accept invitation: ${error.message}`);
      client.emit('error', 'Failed to accept invitation');
    }
  }

  /* =============================== ЛОГИКA ДЛЯ SESSION ============================================================================================== */
  @SubscribeMessage('joinSession')
  async handleJoinSession(
    @MessageBody('sessionId') sessionId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;

    // 1) Запоминаем сессию, связав её с текущим сокетом
    this.socketSessionMap.set(client.id, sessionId);

    // 2) Ищем связь user-сессия для подсчёта времени
    const userSession =
      await this.userCollaborationSessionService.findByUserAndSession(
        userId,
        sessionId,
      );

    const timeSpent = Number(userSession.timeSpent);
    let existingData = this.onlineUsers.get(userId);

    if (!existingData) {
      // Пользователь заходит впервые
      this.onlineUsers.set(userId, {
        sessionId,
        startTime: Date.now(),
        socketIds: new Set([client.id]),
      });
      client.emit('currentTime', { totalTime: timeSpent });
    } else {
      // Пользователь уже был онлайн
      const partialSeconds = (Date.now() - existingData.startTime) / 1000;
      const currentTime = timeSpent + partialSeconds;
      existingData.socketIds.add(client.id);
      client.emit('currentTime', { totalTime: currentTime });
    }

    // Присоединяемся к socket.io комнате
    client.join(`session_${sessionId}`);

    // 3) Получаем полные данные сессии (включая userCollaborationSessions)
    const sessionData =
      await this.collaborationSessionService.getSession(sessionId);

    // 4) Фильтруем только «онлайн» участников из sessionData.userCollaborationSessions
    //    через структуру this.onlineUsers (в которой хранится userId -> { sessionId, ... })
    const onlineUserSessions = sessionData.userCollaborationSessions.filter(
      (ucs) => {
        const onlineData = this.onlineUsers.get(ucs.user.id);
        // «Онлайн», если есть запись в this.onlineUsers и sessionId совпадает
        return onlineData && onlineData.sessionId === sessionId;
      },
    );

    // 5) Приводим каждую связь к формату ICollaborator
    const onlineCollaborators = onlineUserSessions.map((ucs) => ({
      id: ucs.user.id,
      name: ucs.user.name,
      email: ucs.user.email,
      avatar: ucs.user.avatar,
      permissions: ucs.permissions,
    }));

    // 6) Отправляем «обновленную» сессию вместе со списком онлайн-участников
    this.server.to(`session_${sessionId}`).emit('sessionData', {
      session: sessionData,
      users: onlineCollaborators, // ICollaborator[]
    });

    this.logger.log(
      `Client ${client.id} (User ${userId}) joined session ${sessionId}`,
    );
  }

  @SubscribeMessage('leaveSession')
  async handleLeaveSession(@ConnectedSocket() client: Socket) {
    const sessionId = this.socketSessionMap.get(client.id);
    const userId = client.data.userId;
    client.leave(`session_${sessionId}`);
    client.to(`session_${sessionId}`).emit('userLeft', { userId });
  }

  /* =============================== ЛОГИКA ДЛЯ DOCUMENT ============================================================================================== */

  @SubscribeMessage('updateDocument')
  @Roles(Permission.EDIT)
  async handleUpdateDocument(
    @MessageBody('documentId') documentId: number,
    @MessageBody('updates')
    updates: Partial<Pick<Document, 'content' | 'richContent' | 'title'>>,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      const userSession =
        await this.userCollaborationSessionService.findByUserAndSession(
          userId,
          documentId,
        );

      if (!userSession.permissions.includes(Permission.EDIT)) {
        throw new ForbiddenException(
          'You do not have permission to edit this document',
        );
      }

      const updatedDocument = await this.documentService.updateContent(
        documentId,
        updates,
        // If you need the actual user object, fetch from DB:
        { name: 'WebSocket User', email: 'socket@example.com', id: userId },
      );

      const sessionId = updatedDocument.collaborationSession.id;
      client
        .to(`session_${sessionId}`)
        .emit('documentUpdated', updatedDocument);

      this.logger.log(`Document ${documentId} updated by User ${userId}`);
      return updatedDocument;
    } catch (error) {
      this.logger.error(`Error updating document: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('createDocument')
  @Roles(Permission.EDIT)
  async handleCreateDocument(
    @MessageBody('sessionId') sessionId: number,
    @MessageBody('title') title: string,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      const userSession =
        await this.userCollaborationSessionService.findByUserAndSession(
          userId,
          sessionId,
        );

      if (!userSession.permissions.includes(Permission.EDIT)) {
        throw new ForbiddenException(
          'You do not have permission to create documents',
        );
      }

      const newDocument = await this.documentService.createDocument(
        title,
        sessionId,
        userId,
      );

      this.server.to(`session_${sessionId}`).emit('newDocument', newDocument);
      this.logger.log(`Document "${title}" created by User ${userId}`);
      return newDocument;
    } catch (error) {
      this.logger.error(`Error creating document: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('deleteDocument')
  @Roles(Permission.EDIT)
  async handleDeleteDocument(
    @MessageBody('documentId') documentId: number,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      await this.documentService.deleteDocument(documentId, userId);
      client.emit('documentDeleted', { documentId });
    } catch (error) {
      this.logger.error(`Error deleting document: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('duplicateDocument')
  @Roles(Permission.EDIT)
  async handleDuplicateDocument(
    @MessageBody('documentId') documentId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const duplicatedDocument =
      await this.documentService.duplicateDocument(documentId);
    client.emit('documentDuplicated', duplicatedDocument);
  }

  /* ================================ ЛОГИКA ДЛЯ INVITATION ============================================================================================= */

  @SubscribeMessage('createInvitation')
  @Roles(Permission.EDIT)
  async handleCreateInvitation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { email: string; role: Permission; inviterEmail: string },
  ) {
    try {
      const { email, role } = payload;

      const sessionId = this.socketSessionMap.get(client.id);
      if (!sessionId) {
        client.emit('error', 'Session ID not found for this socket');
        return;
      }

      const session =
        await this.collaborationSessionService.findById(sessionId);
      if (!session) {
        client.emit(
          'error',
          `CollaborationSession with id ${sessionId} not found`,
        );
        return;
      }

      const receiver = await this.userService.findByEmail(email);
      if (!receiver) {
        client.emit('error', `User with email ${email} not found`);
        return;
      }

      // Check if the user is already in the session
      const isAlreadyInSession =
        await this.userCollaborationSessionService.findByUserAndSession(
          receiver.id,
          sessionId,
        );

      if (isAlreadyInSession) {
        client.emit(
          'error',
          `User with email ${email} is already a participant in this session`,
        );
        return;
      }

      // Check if the user already has a pending invitation
      const existingInvitation =
        await this.invitationService.findByReceiverAndSession(
          receiver.id,
          sessionId,
        );
      if (existingInvitation) {
        client.emit(
          'error',
          `User with email ${email} already has an invitation for this session`,
        );
        return;
      }

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
      const sessionId = this.socketSessionMap.get(client.id);

      if (!sessionId) {
        throw new Error('Session ID not found for this socket');
      }

      const invitations =
        await this.invitationService.getInvitationsForSession(sessionId);

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
      const updatedInvitation =
        await this.invitationService.changeInvitationRole(
          invitationId,
          newRole,
        );

      // Get session and user IDs for broadcasting
      const sessionId = updatedInvitation.session.id;
      const receiverId = updatedInvitation.receiver.id;

      const sessionRoom = `session_${sessionId}`;
      const dashboardRoom = `dashboard_${receiverId}`;

      // Notify the user who triggered the change
      client.emit('invitationRoleChanged', updatedInvitation);

      // Broadcast the update to both the session and the user's dashboard
      this.server.to(sessionRoom).emit('invitationUpdated', updatedInvitation);
      this.server
        .to(dashboardRoom)
        .emit('invitationUpdated', updatedInvitation);

      this.logger.log(
        `Invitation role changed (Session: ${sessionRoom}, Dashboard: ${dashboardRoom})`,
      );
    } catch (error) {
      this.logger.error(`Error changing invitation role: ${error.message}`);
      client.emit('error', 'Failed to change invitation role');
    }
  }

  /* ============================== ЛОГИКA ДЛЯ MESSAGE =============================================================================================== */

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody('message') messageText: string,
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);

    const userId = client.data.userId;
    const collaborationSession =
      await this.collaborationSessionService.findById(sessionId);

    if (!collaborationSession) {
      throw new Error('Collaboration session not found');
    }

    const sender = { id: userId } as User;
    const message = await this.messagesService.createMessage(
      sender,
      collaborationSession,
      messageText,
    );

    this.server.to(`session_${sessionId}`).emit('newMessage', message);

    return message;
  }

  @SubscribeMessage('getMessages')
  async handleGetMessages(@ConnectedSocket() client: Socket) {
    const sessionId = this.socketSessionMap.get(client.id);
    const collaborationSession =
      await this.collaborationSessionService.findById(sessionId);

    if (!collaborationSession) {
      throw new Error('Collaboration session not found');
    }

    const messages =
      await this.messagesService.getMessagesForSession(collaborationSession);
    client.emit('messages', messages);
  }

  @SubscribeMessage('changeUserPermissions')
  @Roles(Permission.ADMIN)
  async changeUserPermissions(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { userId, permission }: { userId: number; permission: Permission },
  ) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session not found');
      return;
    }

    const userSession =
      await this.userCollaborationSessionService.findByUserAndSession(
        userId,
        sessionId,
      );

    let newPermissions: Permission[] = [Permission.READ];
    if (permission === Permission.EDIT) {
      newPermissions.push(Permission.EDIT);
    } else if (permission === Permission.ADMIN) {
      newPermissions.push(Permission.EDIT, Permission.ADMIN);
    }

    await this.userCollaborationSessionService.updatePermissions(
      userSession.id,
      newPermissions,
    );

    this.server.to(`session_${sessionId}`).emit('permissionsChanged', {
      userId,
      permissions: newPermissions,
    });
  }

  @SubscribeMessage('updateSessionName')
  @Roles(Permission.ADMIN)
  async handleUpdateSessionName(
    @MessageBody()
    { sessionId, newName }: { sessionId: number; newName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('error', 'User not authenticated');
      return;
    }

    await this.collaborationSessionService.updateSessionName(
      sessionId,
      newName,
    );

    const sessionData =
      await this.collaborationSessionService.getSession(sessionId);

    const onlineUserSessions = sessionData.userCollaborationSessions.filter(
      (ucs) => {
        const onlineData = this.onlineUsers.get(ucs.user.id);
        return onlineData && onlineData.sessionId === sessionId;
      },
    );

    const onlineCollaborators = onlineUserSessions.map((ucs) => ({
      id: ucs.user.id,
      name: ucs.user.name,
      email: ucs.user.email,
      avatar: ucs.user.avatar,
      permissions: ucs.permissions,
    }));

    this.server.to(`session_${sessionId}`).emit('sessionData', {
      session: sessionData,
      users: onlineCollaborators,
    });

    this.logger.log(
      `User ${userId} changed session ${sessionId} name to '${newName}'`,
    );
  }
}
