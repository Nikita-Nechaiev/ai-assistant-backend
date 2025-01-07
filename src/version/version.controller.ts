import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { VersionService } from './version.service';

@Controller('versions')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Post('create')
  async createVersion(
    @Body('documentId') documentId: number,
    @Body('content') content: string,
    @Body('richContent') richContent: object | null,
    @Body('metadata') metadata: object | null,
  ) {
    return this.versionService.createVersion(
      documentId,
      content,
      richContent,
      metadata,
    );
  }

  @Get('document/:documentId')
  async getVersionsByDocument(@Param('documentId') documentId: number) {
    return this.versionService.getVersionsByDocument(documentId);
  }
}
