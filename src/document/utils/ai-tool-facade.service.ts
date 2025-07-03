import { Injectable } from '@nestjs/common';
import { AiToolUsageService } from 'src/ai-tool-usage/ai-tool-usage.service';
import { AiTool } from 'src/common/enums/enums';

@Injectable()
export class AiToolFacadeService {
  constructor(private readonly aiToolUsageService: AiToolUsageService) {}

  async executeTool(
    userId: number,
    data: { toolName: AiTool; text: string; documentId: number; targetLanguage?: string },
  ) {
    const { toolName, text, documentId, targetLanguage } = data;

    switch (toolName) {
      case AiTool.GRAMMAR_CHECK:
        return this.aiToolUsageService.checkGrammar(userId, text, documentId);
      case AiTool.TONE_ANALYSIS:
        return this.aiToolUsageService.analyzeTone(userId, text, documentId);
      case AiTool.SUMMARIZATION:
        return this.aiToolUsageService.summarizeText(userId, text, documentId);
      case AiTool.REPHRASE:
        return this.aiToolUsageService.rephraseText(userId, text, documentId);
      case AiTool.TRANSLATION:
        if (!targetLanguage) throw new Error('targetLanguage is required for Translation');

        return this.aiToolUsageService.translateText(userId, text, targetLanguage, documentId);
      case AiTool.KEYWORD_EXTRACTION:
        return this.aiToolUsageService.extractKeywords(userId, text, documentId);
      case AiTool.TEXT_GENERATION:
        return this.aiToolUsageService.generateText(userId, text, documentId);
      case AiTool.READABILITY:
        return this.aiToolUsageService.analyzeReadability(userId, text, documentId);
      case AiTool.TITLE_GENERATION:
        return this.aiToolUsageService.generateTitle(userId, text, documentId);
      case AiTool.USAGE:
        return this.aiToolUsageService.getUsageByDocument(documentId);
      default:
        throw new Error(`Unsupported tool name: ${toolName}`);
    }
  }
}
