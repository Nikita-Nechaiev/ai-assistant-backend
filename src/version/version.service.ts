import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Version } from './version.model';
import { Document } from 'src/document/document.model';

@Injectable()
export class VersionService {
  constructor(
    @InjectRepository(Version)
    private readonly versionRepository: Repository<Version>,
  ) {}

  async getVersionsByDocument(documentId: number): Promise<Version[]> {
    return this.versionRepository.find({
      where: { document: { id: documentId } },
      order: { createdAt: 'DESC' },
    });
  }

  async createVersion(document: Document, richContent: any, userEmail: string): Promise<Version | null> {
    const previousVersion = await this.versionRepository.findOne({
      where: { document: { id: document.id } },
      order: { createdAt: 'DESC' },
    });

    if (previousVersion) {
      const isSameContent = JSON.stringify(previousVersion.richContent) === JSON.stringify(richContent);

      if (isSameContent) {
        return null;
      }
    }

    const newVersion = this.versionRepository.create({
      document,
      richContent,
      userEmail,
    });

    return this.versionRepository.save(newVersion);
  }

  async findById(versionId: number): Promise<Version> {
    const version = await this.versionRepository.findOne({
      where: { id: versionId },
      relations: ['document'],
    });

    if (!version) {
      throw new NotFoundException(`Version with id ${versionId} not found`);
    }

    return version;
  }
}
