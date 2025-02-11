import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.model';
import { VersionModule } from 'src/version/version.module';
import { AiToolUsageModule } from 'src/ai-tool-usage/ai-tool-usage.module';

@Module({
  imports: [
    VersionModule,
    AiToolUsageModule,
    TypeOrmModule.forFeature([Document]),
  ],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
