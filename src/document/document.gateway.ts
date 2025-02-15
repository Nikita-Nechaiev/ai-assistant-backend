import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

import { DocumentService } from 'src/document/document.service';
import { UsersService } from 'src/user/users.service';
import { AiToolUsageService } from 'src/ai-tool-usage/ai-tool-usage.service';
import { VersionService } from 'src/version/version.service';

import { Permission } from 'src/user-collaboration-session/user-collaboration-session.model';
import { Roles } from 'src/common/decorators/roles.decorator';
import { SessionStateService } from 'src/collaboration-session/session-state.service';


@WebSocketGateway({
  path: '/collaboration-session-socket',
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true,
  },
})
export class DocumentGateway {
  @WebSocketServer() private server: Server;
  private readonly logger = new Logger('DocumentGateway');

  constructor(
    private readonly documentService: DocumentService,
    private readonly userService: UsersService,
    private readonly aiToolUsageService: AiToolUsageService,
    private readonly versionService: VersionService,
    private readonly sessionState: SessionStateService,
  ) {}

  @SubscribeMessage('changeDocumentTitle')
  @Roles(Permission.EDIT)
  async handleChangeDocumentTitle(
    @MessageBody() data: { documentId: number; newTitle: string },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }

    try {
      const updatedDocument = await this.documentService.updateLastUpdated(
        data.documentId,
      );

      if (!updatedDocument) {
        client.emit('invalidDocument', {
          message: 'Document not found',
          documentId: data.documentId,
        });
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
      this.logger.error('Error updating document:', error);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
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
    const sessionId = this.sessionState.socketSessionMap.get(client.id);
    if (!sessionId) {
      client.emit('error', 'Session ID not found for this socket');
      return;
    }
    const versions = await this.versionService.getVersionsByDocument(
      data.documentId,
    );
    client.emit('versionsData', versions);
  }
}
