import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { AiToolUsageService } from './ai-tool-usage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ai-tool-usage')
@UseGuards(JwtAuthGuard)
export class AiToolUsageController {
  constructor(private readonly aiToolUsageService: AiToolUsageService) {}

  @Get('user')
  async getUsageByUser(
    @Req() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '5',
  ) {
    const userId = req.user.id; // Extract userId from JWT payload
    // Convert page and limit to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return this.aiToolUsageService.getUsageByUser(userId, pageNum, limitNum);
  }

  // Statistics endpoint
  @Get('user/most-used-tool')
  async getMostFrequentAiTool(@Req() req: any) {
    const userId = req.user.id; // Extract user ID from JWT payload
    const stats = await this.aiToolUsageService.getMostFrequentAiTool(userId);
    return stats;
  }

  @Get('document/:documentId')
  async getUsageByDocument(@Param('documentId') documentId: number) {
    return this.aiToolUsageService.getUsageByDocument(documentId);
  }

  @Post('grammar-check/:documentId?')
  async checkGrammar(
    @Req() req,
    @Body('text') text: string,
    @Param('documentId') documentId?: number,
  ) {
    const userId = req.user.id;
    return this.aiToolUsageService.checkGrammar(userId, text, documentId);
  }

  @Post('tone-analysis/:documentId?')
  async analyzeTone(
    @Req() req,
    @Body('text') text: string,
    @Param('documentId') documentId?: number,
  ) {
    const userId = req.user.id;

    return this.aiToolUsageService.analyzeTone(userId, text, documentId);
  }

  @Post('summarization/:documentId?')
  async summarizeText(
    @Req() req,
    @Body('text') text: string,
    @Param('documentId') documentId?: number,
  ) {
    const userId = req.user.id;
    return this.aiToolUsageService.summarizeText(userId, text, documentId);
  }

  @Post('rephrase/:documentId?')
  async rephraseText(
    @Req() req,
    @Body('text') text: string,
    @Param('documentId') documentId?: number,
  ) {
    const userId = req.user.id;
    return this.aiToolUsageService.rephraseText(userId, text, documentId);
  }

  @Post('translation/:documentId?')
  async translateText(
    @Req() req,
    @Body('text') text: string,
    @Body('targetLanguage') targetLanguage: string,
    @Param('documentId') documentId?: number,
  ) {
    const userId = req.user.id;
    return this.aiToolUsageService.translateText(
      userId,
      text,
      targetLanguage,
      documentId,
    );
  }

  @Post('keyword-extraction/:documentId?')
  async extractKeywords(
    @Req() req,
    @Body('text') text: string,
    @Param('documentId') documentId?: number,
  ) {
    const userId = req.user.id;
    return this.aiToolUsageService.extractKeywords(userId, text, documentId);
  }

  @Post('text-generation/:documentId?')
  async generateText(
    @Req() req,
    @Body('prompt') prompt: string,
    @Param('documentId') documentId?: number,
  ) {
    const userId = req.user.id;
    return this.aiToolUsageService.generateText(userId, prompt, documentId);
  }

  @Post('readability-analysis/:documentId?')
  async analyzeReadability(
    @Req() req,
    @Body('text') text: string,
    @Param('documentId') documentId?: number,
  ) {
    const userId = req.user.id;
    return this.aiToolUsageService.analyzeReadability(userId, text, documentId);
  }

  @Post('title-generation/:documentId?')
  async generateTitle(
    @Req() req,
    @Body('text') text: string,
    @Param('documentId') documentId?: number,
  ) {
    const userId = req.user.id;
    return this.aiToolUsageService.generateTitle(userId, text, documentId);
  }
}
