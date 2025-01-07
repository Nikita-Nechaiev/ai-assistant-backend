import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Version } from './version.model';

@Injectable()
export class VersionService {
  constructor(
    @InjectRepository(Version)
    private readonly versionRepository: Repository<Version>,
  ) {}

  async createVersion(
    documentId: number,
    content: string,
    richContent: object | null,
    metadata: object | null,
  ): Promise<Version> {
    const version = this.versionRepository.create({
      document: { id: documentId },
      content,
      richContent,
      metadata,
    });

    return this.versionRepository.save(version);
  }

  async getVersionsByDocument(documentId: number): Promise<Version[]> {
    return this.versionRepository.find({
      where: { document: { id: documentId } },
      order: { createdAt: 'DESC' },
    });
  }
}
