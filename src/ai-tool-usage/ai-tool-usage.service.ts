import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiToolUsage } from './ai-tool-usage.model';
import { User } from 'src/user/user.model';
import { Document } from 'src/document/document.model';
import OpenAI from 'openai';

@Injectable()
export class AiToolUsageService {
  private openai: OpenAI;

  constructor(
    @InjectRepository(AiToolUsage)
    private readonly aiToolUsageRepository: Repository<AiToolUsage>,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private cleanText(text: string): string {
    return text
      .replace(/\n/g, ' ')
      .replace(/\\/g, '')
      .replace(/\"/g, '')
      .replace(/\s\s+/g, ' ');
  }

  async getUsageByUser(
    userId: number,
    page: number = 1,
    limit: number = 8,
    search?: string,
  ): Promise<AiToolUsage[]> {
    const skip = (page - 1) * limit;

    let queryBuilder = this.aiToolUsageRepository
      .createQueryBuilder('usage')
      .where('usage.userId = :userId', { userId })
      .orderBy('usage.timestamp', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder = queryBuilder.andWhere(
        `(LOWER(usage.toolName) ILIKE :search OR LOWER(usage.sentText) ILIKE :search OR LOWER(usage.result) ILIKE :search)`,
        { search: `%${search.toLowerCase()}%` },
      );
    }

    return queryBuilder.getMany();
  }

  async getAllUsageByUser(userId: number): Promise<AiToolUsage[]> {
    return this.aiToolUsageRepository.find({
      where: { user: { id: userId } },
    });
  }

  async getMostFrequentAiTool(userId: number): Promise<{
    mostFrequentTool: string | null;
    totalUsageNumber: number;
    totalWordCount: number;
    mostInDayUsage: Date | null;
    firstAiUsage: Date | null;
  }> {
    const usage = await this.getAllUsageByUser(userId);

    if (!usage.length) {
      return {
        mostFrequentTool: null,
        totalUsageNumber: 0,
        totalWordCount: 0,
        mostInDayUsage: null,
        firstAiUsage: null,
      };
    }

    const toolFrequency: Record<string, number> = {};
    for (const entry of usage) {
      toolFrequency[entry.toolName] = (toolFrequency[entry.toolName] || 0) + 1;
    }
    const mostFrequentTool = Object.keys(toolFrequency).reduce((a, b) =>
      toolFrequency[a] > toolFrequency[b] ? a : b,
    );

    const totalUsageNumber = usage.length;

    let totalWordCount = 0;
    for (const entry of usage) {
      const wordCount = entry.result.split(/\s+/).filter(Boolean).length;
      totalWordCount += wordCount;
    }

    const sortedUsage = usage
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const firstAiUsage = sortedUsage[0].timestamp;

    const dayCounts: Record<string, number> = {};
    for (const entry of usage) {
      const day = entry.timestamp.toISOString().split('T')[0]; // 'YYYY-MM-DD'
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    const mostUsedDayStr = Object.keys(dayCounts).reduce((a, b) =>
      dayCounts[a] > dayCounts[b] ? a : b,
    );
    const mostInDayUsage = new Date(mostUsedDayStr);

    return {
      mostFrequentTool,
      totalUsageNumber,
      totalWordCount,
      mostInDayUsage,
      firstAiUsage,
    };
  }

  async getUsageByDocument(documentId: number): Promise<AiToolUsage[]> {
    return this.aiToolUsageRepository.find({
      where: { document: { id: documentId } },
    });
  }

  async checkGrammar(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Grammar Checker', userId, text, documentId, {
      role: 'system',
      content: `You are a grammar checker. Give back only the corrected text`,
    });
  }

  async analyzeTone(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Tone Analyzer', userId, text, documentId, {
      role: 'system',
      content: `You MUST NOT write the text again. Give the tone rate in format ... of 100 where 1 is an informal text with a couple mistakes and 100 is a well-written formal text without mistakes.
          Also, shortly tell what is wrong with the text. You MUST NOT correct these mistakes.`,
    });
  }

  async summarizeText(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Summarization', userId, text, documentId, {
      role: 'system',
      content:
        'You are a text summarizer. In 2-4 sentences paraphrase the text',
    });
  }

  async rephraseText(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Rephrasing', userId, text, documentId, {
      role: 'system',
      content:
        'You are a text simplifier. Rephrase and simplify the following text.',
    });
  }

  async translateText(
    userId: number,
    text: string,
    targetLanguage: string,
    documentId?: number,
  ) {
    return this.processAiTool('Translation', userId, text, documentId, {
      role: 'system',
      content: `Translate the following text to ${targetLanguage}.`,
    });
  }

  async extractKeywords(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Keyword Extraction', userId, text, documentId, {
      role: 'system',
      content:
        'Extract the key words and phrases from the following text. Do not write too much text',
    });
  }

  async generateText(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Text Generation', userId, text, documentId, {
      role: 'system',
      content: 'Generate text based on the following prompt.',
    });
  }

  async analyzeReadability(userId: number, text: string, documentId?: number) {
    return this.processAiTool(
      'Readability Analysis',
      userId,
      text,
      documentId,
      {
        role: 'system',
        content: `You MUST NOT write the text again.
          Give the rate in format ... of 100 where 1 is a text that is read difficult and 100 is a text that can be read very easily .
          Also, shortly tell what is wrong with the text. You MUST NOT correct these mistakes.`,
      },
    );
  }

  async generateTitle(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Title Generation', userId, text, documentId, {
      role: 'system',
      content: 'Generate a title for the following text. Maximum 5 words',
    });
  }

  private async processAiTool(
    toolName: string,
    userId: number,
    text: string,
    documentId: number | undefined,
    systemMessage: { role: 'system'; content: string },
  ) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              systemMessage.content +
              ' Provide your response as a single continuous paragraph without any line breaks, special symbols, or markdown formatting. Text can not be longer 2200 symbols.',
          },
          {
            role: 'user',
            content: typeof text === 'string' ? text : JSON.stringify(text),
          },
        ],
      });

      let result = response.choices[0]?.message?.content || '';
      result = this.cleanText(result);

      const aiToolUsage = new AiToolUsage();
      aiToolUsage.user = { id: userId } as User;
      aiToolUsage.toolName = toolName;
      aiToolUsage.sentText = text;
      aiToolUsage.result = result;

      if (documentId) {
        aiToolUsage.document = { id: documentId } as Document;
      }

      return await this.aiToolUsageRepository.save(aiToolUsage);
    } catch (error) {
      console.error(`${toolName} error:`, error.message);
      throw new Error(`${toolName} failed.`);
    }
  }

  async analyzeTextMetrics(
    text: string,
  ): Promise<{ readabilityScore: number; toneAnalysis: number }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a text metrics analyzer. For the provided text, calculate a readability score from 1 to 100 and a tone analysis score from 1 to 100. Provide the response as a JavaScript object in the format: {readabilityScore: <number>, toneAnalysis: <number>}.`,
          },
          { role: 'user', content: text },
        ],
      });

      const result = response.choices[0]?.message?.content || '{}';
      const parsedResult = JSON.parse(result);

      if (
        typeof parsedResult.readabilityScore === 'number' &&
        typeof parsedResult.toneAnalysis === 'number'
      ) {
        return {
          readabilityScore: Math.min(
            Math.max(parsedResult.readabilityScore, 1),
            100,
          ),
          toneAnalysis: Math.min(Math.max(parsedResult.toneAnalysis, 1), 100),
        };
      } else {
        throw new Error('Invalid response format from AI.');
      }
    } catch (error) {
      console.error('AnalyzeTextMetrics error:', error.message);
      throw new Error('Failed to analyze text metrics.');
    }
  }
}
