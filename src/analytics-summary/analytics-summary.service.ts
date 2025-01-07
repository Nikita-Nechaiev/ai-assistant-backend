import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalyticsSummary } from './analytics-summary.model';
import { Repository } from 'typeorm';
import { User } from 'src/user/user.model';

@Injectable()
export class AnalyticsSummaryService {
  constructor(
    @InjectRepository(AnalyticsSummary)
    private readonly analyticsSummaryRepository: Repository<AnalyticsSummary>,
  ) {}

  async getUserAnalytics(userId: number) {
    const analytics = await this.analyticsSummaryRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!analytics) {
      throw new Error('Analytics not found');
    }

    return {
      totalDocuments: analytics.totalDocuments,
      totalWordCount: analytics.totalWordCount,
      mostUsedAiTools: analytics.mostUsedAiTool?.split(',') || [],
      activeHours: analytics.activeHours || {},
    };
  }

  async createBaseAnalytics(user: User): Promise<AnalyticsSummary> {
    if (!user || !user.id) {
      throw new Error('User must be saved before creating analytics summary');
    }
    const baseAnalytics = this.analyticsSummaryRepository.create({
      user,
      totalDocuments: 0,
      totalWordCount: 0,
      totalSessions: 0,
      mostUsedAiTool: '',
      activeHours: 0,
    });

    const savedAnalytics =
      await this.analyticsSummaryRepository.save(baseAnalytics);
    return baseAnalytics;
  }

  async updateAnalytics(userId: number, updates: Partial<AnalyticsSummary>) {
    const analytics = await this.analyticsSummaryRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!analytics) {
      throw new Error('Analytics not found');
    }

    Object.assign(analytics, updates);

    return await this.analyticsSummaryRepository.save(analytics);
  }
}
