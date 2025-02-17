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
import { Logger, UnauthorizedException } from '@nestjs/common';
import { parse } from 'cookie';
import { verify } from 'jsonwebtoken';

import { CollaborationSessionService } from './collaboration-session.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { AuthService } from 'src/auth/auth.service';
import { MessagesService } from 'src/messages/messages.service';

import { Permission } from 'src/user-collaboration-session/user-collaboration-session.model';
import { Roles } from 'src/common/decorators/roles.decorator';
import { SessionStateService } from './session-state.service'; // <-- Our shared state
import { User } from 'src/user/user.model';

/**
 * This gateway deals with:
 * 1) Socket connection/disconnection + authentication
 * 2) Joining/Leaving sessions
 * 3) Chat messages
 * 4) Session-level updates (deletion, rename)
 * 5) User permissions
 */
@WebSocketGateway({
  path: '/collaboration-session-socket',
  cors: {
    origin: [process.env.FRONTEND_URL],
    credentials: true,
  },
})
export class CollaborationSessionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private server: Server;
  private readonly logger = new Logger('CollaborationSessionGateway');

  constructor(
    private readonly collaborationSessionService: CollaborationSessionService,
    private readonly userCollaborationSessionService: UserCollaborationSessionService,
    private readonly authService: AuthService,
    private readonly messagesService: MessagesService,
    private readonly sessionState: SessionStateService, // inject shared state
  ) {}

  afterInit(server: Server) {
    this.logger.log(
      'WebSocket Gateway initialized at /collaboration-session-socket',
    );
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
        } else {
          throw new UnauthorizedException(error.message);
        }
      }
      if (!decoded?.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Attach user ID to socket
      client.data.userId = Number(decoded.sub);

      // Auto-join the "dashboard_userId" room
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);

    if (userId) {
      const userData = this.sessionState.onlineUsers.get(userId);
      if (userData) {
        userData.socketIds.delete(client.id);

        // if no more sockets for this user, update DB for time spent
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

          this.sessionState.onlineUsers.delete(userId);
        }
      }
    }

    this.sessionState.socketSessionMap.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ---------------------------------------------------------------------------
  //                     SESSION (JOIN, LEAVE, DELETE, ETC.)
  // ---------------------------------------------------------------------------
  @SubscribeMessage('joinSession')
  async handleJoinSession(
    @MessageBody('sessionId') sessionId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;

    this.sessionState.socketSessionMap.set(client.id, sessionId);

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
    const existingData = this.sessionState.onlineUsers.get(userId);

    if (!existingData) {
      this.sessionState.onlineUsers.set(userId, {
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

    // figure out who else is online in that session
    const onlineUserSessions = sessionData.userCollaborationSessions.filter(
      (ucs) => {
        const onlineData = this.sessionState.onlineUsers.get(ucs.user.id);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
      const userId = client.data.userId;

      await this.collaborationSessionService.deleteSession(sessionId);

      this.server.to(`session_${sessionId}`).emit('sessionDeleted', {
        sessionId,
        message: 'This session has been deleted by the admin',
        userId,
      });

      this.server.socketsLeave(`session_${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to delete session: ${error.message}`);
      client.emit('error', 'Failed to delete session');
    }
  }

  // ---------------------------------------------------------------------------
  //                            CHAT (MESSAGES)
  // ---------------------------------------------------------------------------
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody('message') messageText: string,
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
    const userId = client.data.userId;
    const collaborationSession =
      await this.collaborationSessionService.findById(sessionId);

    if (!collaborationSession) {
      throw new Error('Collaboration session not found');
    }

    const sender = { id: userId };
    const message = await this.messagesService.createMessage(
      sender as User,
      collaborationSession.id,
      messageText,
    );

    this.server.to(`session_${sessionId}`).emit('newMessage', message);
    return message;
  }

  @SubscribeMessage('getMessages')
  async handleGetMessages(@ConnectedSocket() client: Socket) {
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
    const collaborationSession =
      await this.collaborationSessionService.findById(sessionId);

    if (!collaborationSession) {
      throw new Error('Collaboration session not found');
    }

    const messages =
      await this.messagesService.getMessagesForSession(collaborationSession);
    client.emit('messages', messages);
  }

  // ---------------------------------------------------------------------------
  //                       USER PERMISSIONS & SESSION NAME
  // ---------------------------------------------------------------------------
  @SubscribeMessage('changeUserPermissions')
  @Roles(Permission.ADMIN)
  async changeUserPermissions(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { userId, permission }: { userId: number; permission: Permission },
  ) {
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session not found');
      return;
    }

    const userSession =
      await this.userCollaborationSessionService.findByUserAndSession(
        userId,
        sessionId,
      );

    // By default, at least READ
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
        const onlineData = this.sessionState.onlineUsers.get(ucs.user.id);
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
