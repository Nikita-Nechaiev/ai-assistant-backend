import { Body, Controller, Get, Param, Post, UseGuards, Req, Query } from '@nestjs/common';
import { AiToolUsageService } from './ai-tool-usage.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('ai-tool-usage')
@UseGuards(JwtAuthGuard)
export class AiToolUsageController {
  constructor(private readonly aiToolUsageService: AiToolUsageService) {}

  @Get('user')
  async getUsageByUser(
    @Req() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '8',
    @Query('search') search?: string,
  ) {
    const userId = req.user.id;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    return this.aiToolUsageService.getUsageByUser(userId, pageNum, limitNum, search);
  }

  @Get('user/most-used-tool')
  async getMostFrequentAiTool(@Req() req: any) {
    const userId = req.user.id;
    const stats = await this.aiToolUsageService.getMostFrequentAiTool(userId);

    return stats;
  }

  @Get('document/:documentId')
  async getUsageByDocument(@Param('documentId') documentId: string) {
    const id = documentId ? parseInt(documentId, 10) : undefined;

    return this.aiToolUsageService.getUsageByDocument(id);
  }

  @Post('grammar-check/:documentId?')
  async checkGrammar(@Req() req, @Body('text') text: string, @Param('documentId') documentId?: string) {
    const userId = req.user.id;
    const id = documentId ? parseInt(documentId, 10) : undefined;

    return this.aiToolUsageService.checkGrammar(userId, text, id);
  }

  @Post('tone-analysis/:documentId?')
  async analyzeTone(@Req() req, @Body('text') text: string, @Param('documentId') documentId?: string) {
    const userId = req.user.id;
    const id = documentId ? parseInt(documentId, 10) : undefined;

    return this.aiToolUsageService.analyzeTone(userId, text, id);
  }

  @Post('summarization/:documentId?')
  async summarizeText(@Req() req, @Body('text') text: string, @Param('documentId') documentId?: string) {
    const userId = req.user.id;
    const id = documentId ? parseInt(documentId, 10) : undefined;

    return this.aiToolUsageService.summarizeText(userId, text, id);
  }

  @Post('rephrase/:documentId?')
  async rephraseText(@Req() req, @Body('text') text: string, @Param('documentId') documentId?: string) {
    const userId = req.user.id;
    const id = documentId ? parseInt(documentId, 10) : undefined;

    return this.aiToolUsageService.rephraseText(userId, text, id);
  }

  @Post('translation/:documentId?')
  async translateText(
    @Req() req,
    @Body('text') text: string,
    @Body('targetLanguage') targetLanguage: string,
    @Param('documentId') documentId?: string,
  ) {
    const userId = req.user.id;
    const id = documentId ? parseInt(documentId, 10) : undefined;

    return this.aiToolUsageService.translateText(userId, text, targetLanguage, id);
  }

  @Post('keyword-extraction/:documentId?')
  async extractKeywords(@Req() req, @Body('text') text: string, @Param('documentId') documentId?: string) {
    const userId = req.user.id;
    const id = documentId ? parseInt(documentId, 10) : undefined;

    return this.aiToolUsageService.extractKeywords(userId, text, id);
  }

  @Post('text-generation/:documentId?')
  async generateText(@Req() req, @Body('text') text: string, @Param('documentId') documentId?: string) {
    const userId = req.user.id;
    const id = documentId ? parseInt(documentId, 10) : undefined;

    return this.aiToolUsageService.generateText(userId, text, id);
  }

  @Post('readability-analysis/:documentId?')
  async analyzeReadability(@Req() req, @Body('text') text: string, @Param('documentId') documentId?: string) {
    const userId = req.user.id;
    const id = documentId ? parseInt(documentId, 10) : undefined;

    return this.aiToolUsageService.analyzeReadability(userId, text, id);
  }

  @Post('title-generation/:documentId?')
  async generateTitle(@Req() req, @Body('text') text: string, @Param('documentId') documentId?: string) {
    const userId = req.user.id;
    const id = documentId ? parseInt(documentId, 10) : undefined;

    return this.aiToolUsageService.generateTitle(userId, text, id);
  }
}
