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

  async getUsageByUser(userId: number): Promise<AiToolUsage[]> {
    return this.aiToolUsageRepository.find({
      where: { user: { id: userId } },
    });
  }

  async getMostFrequentAiTool(userId: number): Promise<string | null> {
    const usage = await this.getUsageByUser(userId);

    if (!usage.length) {
      return null; // No usage found for the user
    }

    const toolFrequency = usage.reduce(
      (acc, usageEntry) => {
        acc[usageEntry.toolName] = (acc[usageEntry.toolName] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const mostFrequentTool = Object.keys(toolFrequency).reduce((a, b) =>
      toolFrequency[a] > toolFrequency[b] ? a : b,
    );

    return mostFrequentTool;
  }

  async getUsageByDocument(documentId: number): Promise<AiToolUsage[]> {
    return this.aiToolUsageRepository.find({
      where: { document: { id: documentId } },
    });
  }

  async checkGrammar(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Grammar Checker', userId, text, documentId, {
      role: 'system',
      content: `You are a grammar checker.`,
    });
  }

  async analyzeTone(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Tone Analyzer', userId, text, documentId, {
      role: 'system',
      content:
        'You are a tone analyzer. Analyze the tone of the following text.',
    });
  }

  async summarizeText(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Summarization', userId, text, documentId, {
      role: 'system',
      content: 'Summarize the following text.',
    });
  }

  async rephraseText(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Rephrasing', userId, text, documentId, {
      role: 'system',
      content: 'Rephrase and simplify the following text.',
    });
  }

  async autocompleteText(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Autocomplete', userId, text, documentId, {
      role: 'system',
      content: 'Complete the following text.',
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
      content: 'Extract the key phrases from the following text.',
    });
  }

  async generateText(userId: number, prompt: string, documentId?: number) {
    return this.processAiTool('Text Generation', userId, prompt, documentId, {
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
        content: 'Analyze the readability of the following text.',
      },
    );
  }

  async generateTitle(userId: number, text: string, documentId?: number) {
    return this.processAiTool('Title Generation', userId, text, documentId, {
      role: 'system',
      content: 'Generate a title for the following text.',
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
              ' Provide the corrected text as a single continuous paragraph without any line breaks, special symbols, or markdown formatting.',
          },
          { role: 'user', content: text },
        ],
      });

      let result = response.choices[0]?.message?.content || '';
      result = this.cleanText(result);

      const aiToolUsage = this.aiToolUsageRepository.create({
        user: { id: userId } as User,
        document: documentId ? ({ id: documentId } as Document) : undefined,
        toolName,
        sentText: text,
        result,
      });
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
          ), // Ensure value is between 1 and 100
          toneAnalysis: Math.min(Math.max(parsedResult.toneAnalysis, 1), 100), // Ensure value is between 1 and 100
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
