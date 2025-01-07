import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsSummaryController } from './analytics-summary.controller';
import { AnalyticsSummaryService } from './analytics-summary.service';
import { AnalyticsSummary } from './analytics-summary.model';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsSummary])],
  controllers: [AnalyticsSummaryController],
  providers: [AnalyticsSummaryService],
  exports: [AnalyticsSummaryService],
})
export class AnalyticsSummaryModule {}
