export interface DailyActivityDto {
  date: string;
  documentsCreated: number;
  aiRequests: number;
}

export interface DashboardStatisticsDto {
  overview: {
    totalTimeSpentSeconds: number;
    totalTimeSpentLabel: string;
    totalDocuments: number;
    totalSessions: number;
    createdSessions: number;
    joinedSessions: number;
  };
  activity: {
    startDate: string;
    endDate: string;
    timeZone: 'UTC';
    days: DailyActivityDto[];
    totals: Omit<DailyActivityDto, 'date'>;
    maxDailyCount: number;
  };
}
