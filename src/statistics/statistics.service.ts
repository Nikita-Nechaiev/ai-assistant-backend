import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

import { UserCollaborationSession } from 'src/user-collaboration-session/user-collaboration-session.model';
import { Document } from 'src/document/document.model';
import { AiToolUsage } from 'src/ai-tool-usage/ai-tool-usage.model';
import { Permission } from 'src/common/enums/enums';

import { DailyActivityDto, DashboardStatisticsDto } from './dto/dashboard-statistics.dto';

interface DailyCount {
  date: string;
  count: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = 30;

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(UserCollaborationSession)
    private readonly memberships: Repository<UserCollaborationSession>,
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    @InjectRepository(AiToolUsage)
    private readonly aiUsages: Repository<AiToolUsage>,
  ) {}

  async getDashboard(userId: number): Promise<DashboardStatisticsDto> {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const start = new Date(today - (PERIOD_DAYS - 1) * DAY_IN_MS);
    const end = new Date(today + DAY_IN_MS);
    const adminCondition = `(',' || membership.permissions || ',') LIKE :adminPermission`;
    const documentsQuery = this.documents
      .createQueryBuilder('document')
      .innerJoin('document.collaborationSession', 'session')
      .innerJoin('session.userCollaborationSessions', 'membership')
      .innerJoin('membership.user', 'user')
      .where('user.id = :userId', { userId });

    const [membershipSummary, totalDocuments, documentActivity, aiActivity] = await Promise.all([
      this.memberships
        .createQueryBuilder('membership')
        .innerJoin('membership.user', 'user')
        .where('user.id = :userId', { userId })
        .select('COALESCE(SUM(membership.timeSpent), 0)', 'totalTimeSpentSeconds')
        .addSelect('COUNT(DISTINCT membership.session)', 'totalSessions')
        .addSelect(`COUNT(DISTINCT CASE WHEN ${adminCondition} THEN membership.session END)`, 'createdSessions')
        .setParameter('adminPermission', `%,${Permission.ADMIN},%`)
        .getRawOne<{ totalTimeSpentSeconds: string; totalSessions: string; createdSessions: string }>(),
      documentsQuery.clone().getCount(),
      this.getDailyCounts(documentsQuery.clone(), 'document.createdAt', start, end, 'COUNT(DISTINCT document.id)'),
      this.getDailyCounts(
        this.aiUsages
          .createQueryBuilder('usage')
          .innerJoin('usage.user', 'user')
          .where('user.id = :userId', { userId }),
        'usage.timestamp',
        start,
        end,
      ),
    ]);

    const documentCounts = new Map(documentActivity.map((row) => [row.date, Number(row.count)]));
    const aiCounts = new Map(aiActivity.map((row) => [row.date, Number(row.count)]));
    const days: DailyActivityDto[] = Array.from({ length: PERIOD_DAYS }, (_, index) => {
      const date = new Date(start.getTime() + index * DAY_IN_MS).toISOString().slice(0, 10);

      return {
        date,
        documentsCreated: documentCounts.get(date) ?? 0,
        aiRequests: aiCounts.get(date) ?? 0,
      };
    });
    const totals = days.reduce(
      (sum, day) => ({
        documentsCreated: sum.documentsCreated + day.documentsCreated,
        aiRequests: sum.aiRequests + day.aiRequests,
      }),
      { documentsCreated: 0, aiRequests: 0 },
    );
    const totalTimeSpentSeconds = Math.max(0, Math.floor(Number(membershipSummary?.totalTimeSpentSeconds ?? 0)));
    const totalSessions = Number(membershipSummary?.totalSessions ?? 0);
    const createdSessions = Number(membershipSummary?.createdSessions ?? 0);

    return {
      overview: {
        totalTimeSpentSeconds,
        totalTimeSpentLabel: this.formatDuration(totalTimeSpentSeconds),
        totalDocuments,
        totalSessions,
        createdSessions,
        joinedSessions: totalSessions - createdSessions,
      },
      activity: {
        startDate: start.toISOString().slice(0, 10),
        endDate: new Date(today).toISOString().slice(0, 10),
        timeZone: 'UTC',
        days,
        totals,
        maxDailyCount: Math.max(0, ...days.flatMap((day) => [day.documentsCreated, day.aiRequests])),
      },
    };
  }

  private getDailyCounts<Entity extends ObjectLiteral>(
    query: SelectQueryBuilder<Entity>,
    dateColumn: string,
    start: Date,
    end: Date,
    count = 'COUNT(*)',
  ): Promise<DailyCount[]> {
    const day = `TO_CHAR(${dateColumn}, 'YYYY-MM-DD')`;

    return query
      .select(day, 'date')
      .addSelect(count, 'count')
      .andWhere(`${dateColumn} >= :periodStart AND ${dateColumn} < :periodEnd`, {
        periodStart: start.toISOString().slice(0, 19).replace('T', ' '),
        periodEnd: end.toISOString().slice(0, 19).replace('T', ' '),
      })
      .groupBy(day)
      .orderBy(day, 'ASC')
      .getRawMany<DailyCount>();
  }

  private formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours) return `${hours}h ${minutes}m`;

    if (minutes) return `${minutes}m ${seconds}s`;

    return `${seconds}s`;
  }
}
