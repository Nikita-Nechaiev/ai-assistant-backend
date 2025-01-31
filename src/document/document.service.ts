import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Document } from './document.model';
import { AiToolUsage } from 'src/ai-tool-usage/ai-tool-usage.model';
import { AiToolUsageService } from 'src/ai-tool-usage/ai-tool-usage.service';
import { VersionService } from 'src/version/version.service';
import { AnalyticsSummaryService } from 'src/analytics-summary/analytics-summary.service';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly aiToolUsageService: AiToolUsageService,
    private readonly versionService: VersionService,
    // private readonly analyticsSummaryService: AnalyticsSummaryService,
  ) {}

  async createDocument(
    title: string,
    collaborationSessionId: number,
    userId: number, // Add userId as a parameter
    content?: string,
    richContent?: object,
  ): Promise<Document> {
    const document = this.documentRepository.create({
      title,
      content,
      richContent,
      collaborationSession: { id: collaborationSessionId },
    });

    const savedDocument = await this.documentRepository.save(document);

    // Retrieve analytics and update totalDocuments
    // const analytics =
    //   await this.analyticsSummaryService.getUserAnalytics(userId);

    // await this.analyticsSummaryService.updateAnalytics(userId, {
    //   totalDocuments: analytics.totalDocuments + 1,
    // });

    await this.versionService.createVersion(
      savedDocument.id,
      content || '',
      richContent || null,
      { createdBy: 'system', initialVersion: true }, // Metadata for the initial version
    );

    return savedDocument;
  }

  async deleteDocument(id: number, userId: number): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Retrieve analytics and update totalDocuments
    // const analytics =
    //   await this.analyticsSummaryService.getUserAnalytics(userId);

    // await this.analyticsSummaryService.updateAnalytics(userId, {
    //   totalDocuments: Math.max(analytics.totalDocuments - 1, 0), // Ensure totalDocuments doesn't go below 0
    // });

    await this.documentRepository.remove(document);
  }

  async duplicateDocument(id: number): Promise<Document> {
    const original = await this.documentRepository.findOne({ where: { id } });

    if (!original) {
      throw new Error('Original document not found');
    }

    const duplicate = this.documentRepository.create({
      ...original,
      id: undefined,
      title: `${original.title} (Copy)`,
    });

    return this.documentRepository.save(duplicate);
  }

  async updateContent(
    id: number,
    updates: DeepPartial<Pick<Document, 'content' | 'richContent' | 'title'>>,
    user: { name: string; email: string; id: number }, // Информация о пользователе, который делает изменения
  ): Promise<Document> {
    // Найти документ
    const document = await this.documentRepository.findOne({ where: { id } });

    if (!document) {
      throw new Error('Document not found');
    }

    await this.versionService.createVersion(
      id,
      document.content || '',
      document.richContent || null,
      {
        updatedBy: user.name,
        updatedByEmail: user.email,
        timestamp: new Date().toISOString(),
      },
    );

    Object.assign(document, updates, { lastUpdated: new Date() });
    const updatedDocument = await this.documentRepository.save(document);

    return updatedDocument;
  }

  async updateStatistics(id: number): Promise<Document> {
    const document = await this.documentRepository.findOne({ where: { id } });

    if (!document) {
      throw new Error('Document not found');
    }

    if (!document.content) {
      throw new Error('Document content is required to analyze statistics');
    }

    // Analyze text metrics using AiToolUsageService
    const { readabilityScore, toneAnalysis } =
      await this.aiToolUsageService.analyzeTextMetrics(document.content);

    // Update the document statistics
    document.readabilityScore = readabilityScore;
    document.toneAnalysis = toneAnalysis;
    document.lastUpdated = new Date();

    return this.documentRepository.save(document);
  }

  async getAiToolUsageForDocument(documentId: number) {
    return this.aiToolUsageService.getUsageByDocument(documentId);
  }
}
