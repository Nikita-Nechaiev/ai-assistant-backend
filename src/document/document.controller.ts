import {
  Controller,
  Post,
  Delete,
  Put,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DocumentService } from './document.service';
import { Document } from './document.model';
import { AuthGuard } from '@nestjs/passport';

@Controller('documents')
@UseGuards(AuthGuard('jwt')) // Apply JWT Guard to all endpoints in this controller
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('create')
  async createDocument(
    @Req() req,
    @Body('title') title: string,
    @Body('collaborationSessionId') collaborationSessionId: number,
    @Body('content') content?: string,
    @Body('richContent') richContent?: object,
  ) {
    const userId = req.user.userId;
    return this.documentService.createDocument(
      title,
      collaborationSessionId,
      userId,
      content,
      richContent,
    );
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: number, @Req() req) {
    const userId = req.user.userId;
    return this.documentService.deleteDocument(id, userId);
  }

  @Post(':id/duplicate')
  async duplicateDocument(@Param('id') id: number) {
    return this.documentService.duplicateDocument(id);
  }

  @Put(':id/content')
  async updateContent(
    @Req() req,
    @Param('id') id: number,
    @Body()
    updates: Partial<Pick<Document, 'content' | 'richContent' | 'title'>>,
  ) {
    const user = req.user;
    return this.documentService.updateContent(id, updates, user);
  }

  @Put(':id/statistics')
  async updateStatistics(@Param('id') id: number) {
    return this.documentService.updateStatistics(id);
  }

  @Get(':id/ai-usage')
  async getAiToolUsage(@Param('id') documentId: number) {
    return this.documentService.getAiToolUsageForDocument(documentId);
  }
}
