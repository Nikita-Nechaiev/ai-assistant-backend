import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CollaborationSessionService } from './collaboration-session.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { DocumentService } from 'src/document/document.service';
import {
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { Permission } from 'src/user-collaboration-session/user-collaboration-session.model';
import { Document } from 'src/document/document.model';
import { InvitationService } from 'src/invitation/invitation.service';
import { UsersService } from 'src/user/users.service';
import { WebSocketServer } from '@nestjs/websockets';
import { User } from 'src/user/user.model';
import { MessagesService } from 'src/messages/messages.service';

@WebSocketGateway({ namespace: 'collaboration-session', cors: true })
export class CollaborationSessionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server; // This allows access to the Socket.IO server instance

  private readonly logger = new Logger('CollaborationSessionGateway');
  private onlineUsers: Map<number, { socketId: string; startTime: number }> =
    new Map(); // userId -> { socketId, startTime }

  constructor(
    private readonly userCollaborationSessionService: UserCollaborationSessionService,
    private readonly documentService: DocumentService,
    private readonly invitationService: InvitationService,
    private readonly userService: UsersService,
    private readonly collaborationSessionService: CollaborationSessionService,
    private readonly messagesService: MessagesService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const token = client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        throw new UnauthorizedException('Token is required');
      }

      const decoded = verify(token, process.env.JWT_SECRET) as {
        userId: number;
      };
      client.data.userId = decoded.userId;
      this.onlineUsers.set(decoded.userId, {
        socketId: client.id,
        startTime: Date.now(),
      });
      this.logger.log(
        `Client connected: ${client.id}, UserID: ${decoded.userId}`,
      );
    } catch (error) {
      this.logger.error(`Unauthorized connection attempt: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const userSession = this.onlineUsers.get(userId);
    if (userSession) {
      const timeSpent = Date.now() - userSession.startTime;
      this.logger.log(
        `User ${userId} spent ${timeSpent / 1000}s in the session.`,
      );
      this.onlineUsers.delete(userId);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Присоединение к сессии
  @SubscribeMessage('joinSession')
  async handleJoinSession(
    @MessageBody('sessionId') sessionId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    client.join(`session_${sessionId}`);
    client.to(`session_${sessionId}`).emit('userJoined', { userId });
    this.logger.log(`Client ${client.id} joined session ${sessionId}`);
  }

  // Получение списка пользователей онлайн
  @SubscribeMessage('getOnlineUsers')
  async handleGetOnlineUsers(
    @MessageBody('sessionId') sessionId: number,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Получаем всех клиентов, подключенных к комнате сессии
      const room = this.server.sockets.adapter.rooms.get(
        `session_${sessionId}`,
      );

      if (!room) {
        client.emit('onlineUsers', { users: [] }); // Если никого нет, возвращаем пустой массив
        return;
      }

      const onlineUserIds = Array.from(room)
        .map((socketId) => {
          const socket = this.server.sockets.sockets.get(socketId);
          return socket?.data.userId; // Извлекаем userId из сокетов
        })
        .filter(Boolean); // Убираем undefined или null

      // Используем usersService для получения полной информации о пользователях
      const users = await Promise.all(
        onlineUserIds.map((userId) => this.userService.findById(userId)),
      );

      // Отправляем список пользователей обратно клиенту
      client.emit('onlineUsers', { users });
    } catch (error) {
      this.logger.error(`Error fetching online users: ${error.message}`);
      throw error;
    }
  }

  // Обновление содержимого документа
  @SubscribeMessage('updateDocument')
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
        { name: 'WebSocket User', email: 'socket@example.com', id: 1 },
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

  // Создание нового документа
  @SubscribeMessage('createDocument')
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
      client.to(`session_${sessionId}`).emit('documentCreated', newDocument);

      this.logger.log(`Document "${title}" created by User ${userId}`);
      return newDocument;
    } catch (error) {
      this.logger.error(`Error creating document: ${error.message}`);
      throw error;
    }
  }

  // Удаление документа
  @SubscribeMessage('deleteDocument')
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

  // Дублирование документа
  @SubscribeMessage('duplicateDocument')
  async handleDuplicateDocument(
    @MessageBody('documentId') documentId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const duplicatedDocument =
      await this.documentService.duplicateDocument(documentId);
    client.emit('documentDuplicated', duplicatedDocument);
  }

  @SubscribeMessage('sendInvite')
  async handleSendInvite(
    @MessageBody('sessionId') sessionId: number,
    @MessageBody('email') email: string,
    @MessageBody('role') role: string,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const inviterId = client.data.userId;

      // Добавьте проверку прав на отправку приглашений
      const userSession =
        await this.userCollaborationSessionService.findByUserAndSession(
          inviterId,
          sessionId,
        );

      if (!userSession.permissions.includes(Permission.EDIT)) {
        throw new ForbiddenException(
          'You do not have permission to send invitations',
        );
      }

      const inviter = `User ID: ${inviterId}`; // Или имя пользователя, если доступно
      const invitation = await this.invitationService.createInvitation(
        sessionId,
        email,
        role,
        inviter,
      );

      client.emit('inviteSent', { invitation });
      this.logger.log(
        `Invitation sent by User ${inviterId} to ${email} for session ${sessionId}`,
      );
    } catch (error) {
      this.logger.error(`Error sending invite: ${error.message}`);
      throw error;
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody('sessionId') sessionId: number,
    @MessageBody('message') messageText: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;

    const collaborationSession =
      await this.collaborationSessionService.findById(sessionId);

    if (!collaborationSession) {
      throw new Error('Collaboration session not found');
    }

    const sender = { id: userId } as User; // Replace with userService.findById if needed
    const message = await this.messagesService.createMessage(
      sender,
      collaborationSession,
      messageText,
    );

    // Broadcast the message to other participants
    client.to(`session_${sessionId}`).emit('newMessage', message);

    return message;
  }

  @SubscribeMessage('getMessages')
  async handleGetMessages(
    @MessageBody('sessionId') sessionId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const collaborationSession =
      await this.collaborationSessionService.findById(sessionId);

    if (!collaborationSession) {
      throw new Error('Collaboration session not found');
    }

    const messages =
      await this.messagesService.getMessagesForSession(collaborationSession);

    client.emit('messages', messages);
  }

  // Выход из сессии
  @SubscribeMessage('leaveSession')
  async handleLeaveSession(
    @MessageBody('sessionId') sessionId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    client.leave(`session_${sessionId}`);
    client.to(`session_${sessionId}`).emit('userLeft', { userId });
  }
}
