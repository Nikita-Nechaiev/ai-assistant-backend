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
import { Logger, UnauthorizedException } from '@nestjs/common';

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
import { Roles } from 'src/common/decorators/roles.decorator';
import { AiToolUsageService } from 'src/ai-tool-usage/ai-tool-usage.service';
import { VersionService } from 'src/version/version.service';

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
    private readonly aiToolUsageService: AiToolUsageService,
    private readonly versionService: VersionService,
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
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            await this.authService.refresh(refreshToken);
          accessToken = newAccessToken;
          refreshToken = newRefreshToken;
          decoded = verify(accessToken, process.env.JWT_ACCESS_SECRET);

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
        userData.socketIds.delete(client.id);

        if (userData.socketIds.size === 0) {
          const timeSpentSeconds = (Date.now() - userData.startTime) / 1000;

          const sessionExists =
            await this.collaborationSessionService.findById(sessionId);
          if (sessionExists) {
            await this.userCollaborationSessionService.updateTimeSpent(
              userId,
              sessionId,
              timeSpentSeconds,
            );

            await this.userCollaborationSessionService.updateLastInteracted(
              userId,
              sessionId,
              new Date(),
            );

            this.logger.log(
              `User ${userId} spent ${timeSpentSeconds}s in the session (${sessionId}).`,
            );

            this.server.to(`session_${sessionId}`).emit('userLeft', { userId });
          } else {
            this.logger.warn(
              `Session ${sessionId} has already been deleted. Skipping updates.`,
            );
          }

          this.onlineUsers.delete(userId);
        }
      }
    }

    this.socketSessionMap.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ====================== LOGIC FOR DASHBOARD / NOTIFICATIONS ====================== //
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

  /* =============================== SESSION LOGIC ============================================================================================== */
  @SubscribeMessage('joinSession')
  async handleJoinSession(
    @MessageBody('sessionId') sessionId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;

    this.socketSessionMap.set(client.id, sessionId);

    const userSession =
      await this.userCollaborationSessionService.findByUserAndSession(
        userId,
        sessionId,
      );

    if (!userSession) {
      client.emit('invalidSession', {
        message: 'You do not have permission to access this page',
      });
      return;
    }

    const timeSpent = Number(userSession.timeSpent);
    let existingData = this.onlineUsers.get(userId);

    if (!existingData) {
      this.onlineUsers.set(userId, {
        sessionId,
        startTime: Date.now(),
        socketIds: new Set([client.id]),
      });
      client.emit('currentTime', { totalTime: timeSpent });
    } else {
      const partialSeconds = (Date.now() - existingData.startTime) / 1000;
      const currentTime = timeSpent + partialSeconds;
      existingData.socketIds.add(client.id);
      client.emit('currentTime', { totalTime: currentTime });
    }

    client.join(`session_${sessionId}`);

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

  @SubscribeMessage('deleteSession')
  @Roles(Permission.EDIT)
  async handleDeleteSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: number },
  ) {
    try {
      const { sessionId } = data;

      await this.collaborationSessionService.deleteSession(sessionId);

      this.server.to(`session_${sessionId}`).emit('sessionDeleted', {
        sessionId,
        message: 'This session has been deleted by the admin',
      });

      this.server.socketsLeave(`session_${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to delete session: ${error.message}`);
      client.emit('error', 'Failed to delete session');
    }
  }

  /* =============================== DOCUMENT LOGIC ============================================================================================== */
  @SubscribeMessage('changeDocumentTitle')
  @Roles(Permission.EDIT)
  async handleChangeDocumentTitle(
    @MessageBody() data: { documentId: number; newTitle: string },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }

    const updatedDocument = await this.documentService.changeDocumentTitle(
      data.documentId,
      data.newTitle,
    );

    this.server
      .to(`session_${sessionId}`)
      .emit('documentUpdated', updatedDocument);
  }

  @SubscribeMessage('createDocument')
  @Roles(Permission.EDIT)
  async handleCreateDocument(
    @MessageBody() data: { title: string },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);

    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }

    const user = await this.userService.findById(client.data.userId);
    const { document: newDocument, version } =
      await this.documentService.createDocument(
        sessionId,
        user.email,
        data.title,
      );

    this.server.to(`session_${sessionId}`).emit('documentCreated', newDocument);
    this.server.to(`session_${sessionId}`).emit('versionCreated', version);
  }

  @SubscribeMessage('deleteDocument')
  @Roles(Permission.EDIT)
  async handleDeleteDocument(
    @MessageBody() data: { documentId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }

    await this.documentService.deleteDocument(data.documentId);

    this.server
      .to(`session_${sessionId}`)
      .emit('documentDeleted', { documentId: data.documentId });
  }

  @SubscribeMessage('duplicateDocument')
  @Roles(Permission.EDIT)
  async handleDuplicateDocument(
    @MessageBody() data: { documentId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }

    const user = await this.userService.findById(client.data.userId);
    const { document: duplicate, version } =
      await this.documentService.duplicateDocument(data.documentId, user.email);

    this.server
      .to(`session_${sessionId}`)
      .emit('documentDuplicated', duplicate);
    this.server.to(`session_${sessionId}`).emit('versionCreated', version);
  }

  @SubscribeMessage('getSessionDocuments')
  async handleGetSessionDocuments(@ConnectedSocket() client: Socket) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }

    const documents = await this.documentService.getSessionDocuments(sessionId);
    client.emit('sessionDocuments', documents);
  }

  @SubscribeMessage('changeContentAndSaveDocument')
  @Roles(Permission.EDIT)
  async handleChangeContentAndSaveDocument(
    @MessageBody() data: { documentId: number; newContent: any },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }

    const user = await this.userService.findById(client.data.userId);
    const { document: updatedDocument, version } =
      await this.documentService.changeContentAndSaveDocument(
        data.documentId,
        data.newContent,
        user.email,
      );

    this.server
      .to(`session_${sessionId}`)
      .emit('documentUpdated', updatedDocument);
    this.server.to(`session_${sessionId}`).emit('versionCreated', version);
  }

  @SubscribeMessage('applyVersion')
  @Roles(Permission.EDIT)
  async handleApplyVersion(
    @MessageBody() data: { documentId: number; versionId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }

    const user = await this.userService.findById(client.data.userId);
    const { document: updatedDocument, version } =
      await this.documentService.applyVersion(
        data.documentId,
        data.versionId,
        user.email,
      );

    this.server
      .to(`session_${sessionId}`)
      .emit('documentUpdated', updatedDocument);
    this.server.to(`session_${sessionId}`).emit('versionCreated', version);
  }

  @SubscribeMessage('getDocument')
  async handleGetDocument(
    @MessageBody() data: { documentId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }

    try {
      const updatedDocument = await this.documentService.updateLastUpdated(
        data.documentId,
      );

      if (updatedDocument.collaborationSession.id !== sessionId) {
        client.emit('invalidDocument', {
          message: 'Document does not belong to this session',
          documentId: data.documentId,
        });
        return;
      }

      if (!updatedDocument) {
        client.emit('invalidDocument', {
          message: 'Document not found',
          documentId: data.documentId,
        });
        return;
      }

      client.emit('documentData', updatedDocument);
      client.emit('lastEditedDocument', updatedDocument);
    } catch (error) {
      console.error('Error updating document:', error);
      client.emit('invalidDocument', {
        message: 'Invalid document page',
        documentId: data.documentId,
      });
    }
  }

  @SubscribeMessage('getDocumentAiUsage')
  @Roles(Permission.EDIT)
  async handleGetDocumentAiUsage(
    @MessageBody() data: { documentId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }
    const usage = await this.aiToolUsageService.getUsageByDocument(
      data.documentId,
    );
    this.server.to(`session_${sessionId}`).emit('documentAiUsage', usage);
  }

  @SubscribeMessage('createDocumentAiUsage')
  async handleCreateDocumentAiUsage(
    @MessageBody()
    data: {
      toolName: string;
      text: string;
      documentId: number;
      targetLanguage?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }
    const user = await this.userService.findById(client.data.userId);
    let usage;
    switch (data.toolName) {
      case 'grammar-check':
        usage = await this.aiToolUsageService.checkGrammar(
          user.id,
          data.text,
          data.documentId,
        );
        break;
      case 'tone-analysis':
        usage = await this.aiToolUsageService.analyzeTone(
          user.id,
          data.text,
          data.documentId,
        );
        break;
      case 'summarization':
        usage = await this.aiToolUsageService.summarizeText(
          user.id,
          data.text,
          data.documentId,
        );
        break;
      case 'rephrase':
        usage = await this.aiToolUsageService.rephraseText(
          user.id,
          data.text,
          data.documentId,
        );
        break;
      case 'translation':
        if (!data.targetLanguage) {
          client.emit('error', 'targetLanguage is required for Translation');
          return;
        }
        usage = await this.aiToolUsageService.translateText(
          user.id,
          data.text,
          data.targetLanguage,
          data.documentId,
        );
        break;
      case 'keyword-extraction':
        usage = await this.aiToolUsageService.extractKeywords(
          user.id,
          data.text,
          data.documentId,
        );
        break;
      case 'text-generation':
        usage = await this.aiToolUsageService.generateText(
          user.id,
          data.text,
          data.documentId,
        );
        break;
      case 'readability-analysis':
        usage = await this.aiToolUsageService.analyzeReadability(
          user.id,
          data.text,
          data.documentId,
        );
        break;
      case 'title-generation':
        usage = await this.aiToolUsageService.generateTitle(
          user.id,
          data.text,
          data.documentId,
        );
        break;
      default:
        client.emit('error', 'Unsupported tool name');
        return;
    }

    this.server
      .to(`session_${sessionId}`)
      .emit('documentAiUsageCreated', usage);
  }

  @SubscribeMessage('getVersions')
  @Roles(Permission.EDIT)
  async handleGetVersions(
    @MessageBody() data: { documentId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }
    const versions = await this.versionService.getVersionsByDocument(
      data.documentId,
    );
    client.emit('versionsData', versions);
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
      collaborationSession.id,
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
    { newName }: { newName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    const sessionId = this.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session not found');
      return;
    }

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
