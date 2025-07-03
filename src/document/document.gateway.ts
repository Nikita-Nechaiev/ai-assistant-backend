import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { DocumentService } from 'src/document/document.service';
import { UsersService } from 'src/user/users.service';
import { VersionService } from 'src/version/version.service';
import { AiToolFacadeService } from 'src/document/utils/ai-tool-facade.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AiTool, Permission } from 'src/common/enums/enums';
import { sessionRoom } from 'src/common/utils/room.util';
import { SessionContextService } from 'src/common/utils/session-context.service';

@WebSocketGateway({
  path: '/collaboration-session-socket',
  cors: { origin: [process.env.FRONTEND_URL], credentials: true },
})
export class DocumentGateway {
  @WebSocketServer() private server: Server;
  constructor(
    private readonly documentService: DocumentService,
    private readonly usersService: UsersService,
    private readonly versionService: VersionService,
    private readonly sessionContextService: SessionContextService,
    private readonly aiToolFacadeService: AiToolFacadeService,
  ) {}

  private emitToSession(sessionId: number, event: string, payload: any) {
    this.server.to(sessionRoom(sessionId)).emit(event, payload);
  }

  @SubscribeMessage('changeDocumentTitle')
  @Roles(Permission.EDIT)
  async changeDocumentTitle(
    @MessageBody() data: { documentId: number; newTitle: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);
      const updatedDocument = await this.documentService.changeDocumentTitle(data.documentId, data.newTitle);

      this.emitToSession(sessionId, 'documentUpdated', updatedDocument);
    } catch (error) {
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('createDocument')
  @Roles(Permission.EDIT)
  async createDocument(@MessageBody() data: { title: string }, @ConnectedSocket() client: Socket) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);
      const user = await this.usersService.findById(client.data.userId);
      const { document: newDocument, version } = await this.documentService.createDocument(
        sessionId,
        user.email,
        data.title,
      );

      this.emitToSession(sessionId, 'documentCreated', newDocument);
      this.emitToSession(sessionId, 'versionCreated', version);
    } catch (error) {
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('deleteDocument')
  @Roles(Permission.EDIT)
  async deleteDocument(@MessageBody() data: { documentId: number }, @ConnectedSocket() client: Socket) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);

      await this.documentService.deleteDocument(data.documentId);
      this.emitToSession(sessionId, 'documentDeleted', { documentId: data.documentId });
    } catch (error) {
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('duplicateDocument')
  @Roles(Permission.EDIT)
  async duplicateDocument(@MessageBody() data: { documentId: number }, @ConnectedSocket() client: Socket) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);
      const user = await this.usersService.findById(client.data.userId);
      const { document: duplicate, version } = await this.documentService.duplicateDocument(
        data.documentId,
        user.email,
      );

      this.emitToSession(sessionId, 'documentDuplicated', duplicate);
      this.emitToSession(sessionId, 'versionCreated', version);
    } catch (error) {
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('getSessionDocuments')
  async getSessionDocuments(@MessageBody('sessionId') sessionId: number, @ConnectedSocket() client: Socket) {
    try {
      const documents = await this.documentService.getSessionDocuments(sessionId);

      client.emit('sessionDocuments', documents);
    } catch (error) {
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('changeContentAndSaveDocument')
  @Roles(Permission.EDIT)
  async changeContentAndSaveDocument(
    @MessageBody() data: { documentId: number; newContent: any },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);
      const user = await this.usersService.findById(client.data.userId);
      const { document: updatedDocument, version } = await this.documentService.changeContentAndSaveDocument(
        data.documentId,
        data.newContent,
        user.email,
      );

      this.emitToSession(sessionId, 'documentUpdated', updatedDocument);
      this.emitToSession(sessionId, 'versionCreated', version);
    } catch (error) {
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('applyVersion')
  @Roles(Permission.EDIT)
  async applyVersion(
    @MessageBody() data: { documentId: number; versionId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);
      const user = await this.usersService.findById(client.data.userId);
      const { document: updatedDocument, version } = await this.documentService.applyVersion(
        data.documentId,
        data.versionId,
        user.email,
      );

      this.emitToSession(sessionId, 'documentUpdated', updatedDocument);
      this.emitToSession(sessionId, 'versionCreated', version);
    } catch (error) {
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('getDocument')
  async getDocument(@MessageBody() data: { documentId: number }, @ConnectedSocket() client: Socket) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);
      const updatedDocument = await this.documentService.updateLastUpdated(data.documentId);

      if (!updatedDocument) {
        client.emit('invalidDocument', { message: 'Document not found', documentId: data.documentId });

        return;
      }

      if (updatedDocument.collaborationSession.id !== sessionId) {
        client.emit('invalidDocument', {
          message: 'Document does not belong to this session',
          documentId: data.documentId,
        });

        return;
      }

      client.emit('documentData', updatedDocument);
      client.emit('lastEditedDocument', updatedDocument);
    } catch (error) {
      client.emit('invalidDocument', { message: error.message, documentId: data.documentId });
    }
  }

  @SubscribeMessage('getDocumentAiUsage')
  @Roles(Permission.EDIT)
  async getDocumentAiUsage(@MessageBody() data: { documentId: number }, @ConnectedSocket() client: Socket) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);
      const usage = await this.aiToolFacadeService.executeTool(client.data.userId, {
        toolName: AiTool.USAGE,
        text: '',
        documentId: data.documentId,
      });

      this.emitToSession(sessionId, 'documentAiUsage', usage);
    } catch (error) {
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('createDocumentAiUsage')
  async createDocumentAiUsage(
    @MessageBody() data: { toolName: AiTool; text: string; documentId: number; targetLanguage?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const sessionId = this.sessionContextService.getSessionIdOrThrow(client);
      const usage = await this.aiToolFacadeService.executeTool(client.data.userId, data);

      this.emitToSession(sessionId, 'documentAiUsageCreated', usage);
    } catch (error) {
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('getVersions')
  @Roles(Permission.EDIT)
  async getVersions(@MessageBody() data: { documentId: number }, @ConnectedSocket() client: Socket) {
    try {
      const versions = await this.versionService.getVersionsByDocument(data.documentId);

      client.emit('versionsData', versions);
    } catch (error) {
      client.emit('error', error.message);
    }
  }
}
