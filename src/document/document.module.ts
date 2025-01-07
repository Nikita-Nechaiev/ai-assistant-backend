import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.model';
import { VersionModule } from 'src/version/version.module';
import { AiToolUsageModule } from 'src/ai-tool-usage/ai-tool-usage.module';
import { AnalyticsSummaryModule } from 'src/analytics-summary/analytics-summary.module';

@Module({
  imports: [
    VersionModule,
    AiToolUsageModule,
    AnalyticsSummaryModule,
    TypeOrmModule.forFeature([Document]),
  ],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
