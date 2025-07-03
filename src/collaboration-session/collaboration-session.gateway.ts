import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { parse } from 'cookie';
import { verify } from 'jsonwebtoken';

import { AuthService } from 'src/auth/auth.service';
import { MessagesService } from 'src/messages/messages.service';
import { SessionPresenceService } from 'src/collaboration-session/presence/session-presence.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';

import { Roles } from 'src/common/decorators/roles.decorator';
import { Permission } from 'src/common/enums/enums';
import { User } from 'src/user/user.model';
import { dashboardRoom, sessionRoom } from 'src/common/utils/room.util';
import { CollaborationSessionService } from './collaboration-session.service';

@WebSocketGateway({
  path: '/collaboration-session-socket',
  cors: { origin: [process.env.FRONTEND_URL], credentials: true },
})
export class CollaborationSessionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server: Server;
  private readonly logger = new Logger(CollaborationSessionGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly presence: SessionPresenceService,
    private readonly messagesService: MessagesService,
    private readonly userSessionService: UserCollaborationSessionService,
    private readonly collaborationSessionService: CollaborationSessionService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialised');
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const cookies = parse(client.handshake.headers.cookie ?? '');
      let access = cookies['accessToken'];
      let refresh = cookies['refreshToken'];

      if (!access || !refresh) throw new UnauthorizedException('Missing tokens');

      let decoded: any;

      try {
        decoded = verify(access, process.env.JWT_ACCESS_SECRET);
      } catch (e) {
        if (e.name === 'TokenExpiredError') {
          const tokens = await this.authService.refresh(refresh);

          access = tokens.accessToken;
          refresh = tokens.refreshToken;
          decoded = verify(access, process.env.JWT_ACCESS_SECRET);
          client.handshake.headers.cookie = `accessToken=${access}; refreshToken=${refresh}`;
        } else {
          throw new UnauthorizedException(e.message);
        }
      }

      client.data.userId = Number(decoded.sub);
      client.join(dashboardRoom(client.data.userId));
    } catch (e) {
      this.logger.error(`Unauthorised socket: ${e.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    const sessionId = await this.presence.leave(client.id, client.data.userId);

    if (sessionId) {
      this.server.to(sessionRoom(sessionId)).emit('userLeft', { userId: client.data.userId });
    }
  }

  @SubscribeMessage('joinSession')
  async joinSession(@MessageBody('sessionId') sessionId: number, @ConnectedSocket() client: Socket) {
    const { isAllowed, snapshot, isFirstJoin, newUser } = await this.presence.join(client, sessionId);

    if (!isAllowed) {
      client.emit('invalidSession', { message: 'You do not have permission to access this page' });

      return;
    }

    client.join(sessionRoom(sessionId));

    client.emit('totalSessionData', snapshot);

    if (isFirstJoin) {
      client.to(sessionRoom(sessionId)).emit('newOnlineUser', newUser);
    }
  }

  @SubscribeMessage('getSessionData')
  async getTotalSessionData(@MessageBody('sessionId') reqId: number | undefined, @ConnectedSocket() client: Socket) {
    const sessionId = reqId ?? this.presence.getSessionIdBySocket(client.id);

    if (!sessionId) {
      return;
    }

    const snapshot = await this.presence.getSessionTotalData(client, sessionId);

    client.emit('totalSessionData', snapshot);
  }

  @SubscribeMessage('leaveSession')
  async leaveSession(@ConnectedSocket() client: Socket) {
    const sessionId = await this.presence.leave(client.id, client.data.userId);

    if (sessionId) {
      client.leave(sessionRoom(sessionId));
      client.to(sessionRoom(sessionId)).emit('userLeft', { userId: client.data.userId });
    }
  }

  @SubscribeMessage('deleteSession')
  @Roles(Permission.ADMIN)
  async deleteSession(@ConnectedSocket() client: Socket, @MessageBody('sessionId') sessionId: number) {
    await this.collaborationSessionService.deleteSession(sessionId);

    await this.presence.leave(client.id, client.data.userId);

    this.server.to(sessionRoom(sessionId)).emit('sessionDeleted', {
      sessionId,
      message: 'This session has been deleted by the admin',
      userId: client.data.userId,
    });

    this.server.socketsLeave(sessionRoom(sessionId));
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(@MessageBody('message') text: string, @ConnectedSocket() client: Socket) {
    const sessionId = this.presence.getSessionIdBySocket(client.id);

    if (!sessionId) return;

    const message = await this.messagesService.createMessage({ id: client.data.userId } as User, sessionId, text);

    this.server.to(sessionRoom(sessionId)).emit('newMessage', message);
  }

  @SubscribeMessage('getMessages')
  async getMessages(@ConnectedSocket() client: Socket) {
    const sessionId = this.presence.getSessionIdBySocket(client.id);

    if (!sessionId) return;

    const msgs = await this.messagesService.getMessagesForSession(
      await this.collaborationSessionService.findById(sessionId),
    );

    client.emit('messages', msgs);
  }

  @SubscribeMessage('changeUserPermissions')
  @Roles(Permission.ADMIN)
  async changePermissions(
    @ConnectedSocket() client: Socket,
    @MessageBody() { userId, permission }: { userId: number; permission: Permission },
  ) {
    const sessionId = this.presence.getSessionIdBySocket(client.id);

    if (!sessionId) return;

    const userSession = await this.userSessionService.findByUserAndSession(userId, sessionId);

    const list: Permission[] =
      permission === Permission.ADMIN
        ? [Permission.READ, Permission.EDIT, Permission.ADMIN]
        : permission === Permission.EDIT
          ? [Permission.READ, Permission.EDIT]
          : [Permission.READ];

    await this.userSessionService.updatePermissions(userSession.id, list);
    this.server.to(sessionRoom(sessionId)).emit('permissionsChanged', { userId, permissions: list });
  }

  @SubscribeMessage('updateSessionName')
  @Roles(Permission.ADMIN)
  async renameSession(@MessageBody('newName') name: string, @ConnectedSocket() client: Socket) {
    const sessionId = this.presence.getSessionIdBySocket(client.id);

    if (!sessionId) return;

    await this.collaborationSessionService.updateSessionName(sessionId, name);

    const sessionData = await this.presence.getSessionData(sessionId);

    this.server.to(sessionRoom(sessionId)).emit('sessionData', sessionData);
  }
}
