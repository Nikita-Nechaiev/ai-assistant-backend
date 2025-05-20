import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './document.model';
import { VersionService } from 'src/version/version.service';
import { Version } from 'src/version/version.model';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly versionService: VersionService,
  ) {}

  async findById(documentId: number): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    return document;
  }

  async changeDocumentTitle(documentId: number, newTitle: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    document.title = newTitle;

    const updatedDocument = await this.documentRepository.save(document);

    return updatedDocument;
  }

  async createDocument(
    sessionId: number,
    userEmail: string,
    title: string,
  ): Promise<{ document: Document; version: Version }> {
    const newDocument = this.documentRepository.create({
      title,
      richContent: ' ',
      collaborationSession: { id: sessionId } as any,
    });

    const savedDocument = await this.documentRepository.save(newDocument);

    const version = await this.versionService.createVersion(savedDocument, savedDocument.richContent, userEmail);

    return { document: savedDocument, version };
  }

  async duplicateDocument(documentId: number, userEmail: string): Promise<{ document: Document; version: Version }> {
    const originalDocument = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['collaborationSession'],
    });

    if (!originalDocument) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    const duplicate = this.documentRepository.create({
      title: originalDocument.title + ' (Copy)',
      richContent: originalDocument.richContent,
      collaborationSession: originalDocument.collaborationSession,
    });

    const savedDuplicate = await this.documentRepository.save(duplicate);

    const version = await this.versionService.createVersion(savedDuplicate, savedDuplicate.richContent, userEmail);

    return { document: savedDuplicate, version };
  }

  async changeContentAndSaveDocument(
    documentId: number,
    newContent: any,
    userEmail: string,
  ): Promise<{ document: Document; version: Version }> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    document.richContent = newContent;
    document.lastUpdated = new Date();

    const updatedDocument = await this.documentRepository.save(document);

    const version = await this.versionService.createVersion(updatedDocument, newContent, userEmail);

    return { document: updatedDocument, version };
  }

  async getSessionDocuments(sessionId: number): Promise<Document[]> {
    return await this.documentRepository.find({
      where: {
        collaborationSession: { id: sessionId },
      },
      order: {
        lastUpdated: 'DESC',
      },
    });
  }

  async applyVersion(
    documentId: number,
    versionId: number,
    userEmail: string,
  ): Promise<{ document: Document; version: Version }> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    const versionRecord = await this.versionService.findById(versionId);

    if (!versionRecord || versionRecord.document.id !== documentId) {
      throw new NotFoundException(`Version with id ${versionId} not found for document ${documentId}`);
    }

    document.richContent = versionRecord.richContent;

    const updatedDocument = await this.documentRepository.save(document);

    const newVersion = await this.versionService.createVersion(updatedDocument, updatedDocument.richContent, userEmail);

    return { document: updatedDocument, version: newVersion };
  }

  async deleteDocument(documentId: number): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    await this.documentRepository.remove(document);
  }

  async updateLastUpdated(documentId: number): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['collaborationSession'],
    });

    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    document.lastUpdated = new Date();

    const updatedDocument = await this.documentRepository.save(document);

    return updatedDocument;
  }
}
