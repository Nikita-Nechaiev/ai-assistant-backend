import { StatisticsService } from './statistics.service';

const query = () => {
  const builder: any = {};

  for (const method of [
    'innerJoin',
    'where',
    'select',
    'addSelect',
    'setParameter',
    'andWhere',
    'groupBy',
    'orderBy',
  ]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }

  builder.clone = jest.fn().mockReturnValue(builder);
  builder.getRawOne = jest.fn();
  builder.getRawMany = jest.fn().mockResolvedValue([]);
  builder.getCount = jest.fn().mockResolvedValue(0);

  return builder;
};

describe('StatisticsService', () => {
  let memberships: ReturnType<typeof query>;
  let documents: ReturnType<typeof query>;
  let usages: ReturnType<typeof query>;
  let service: StatisticsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T23:30:00Z'));
    memberships = query();
    documents = query();
    usages = query();
    service = new StatisticsService(
      { createQueryBuilder: jest.fn().mockReturnValue(memberships) } as any,
      { createQueryBuilder: jest.fn().mockReturnValue(documents) } as any,
      { createQueryBuilder: jest.fn().mockReturnValue(usages) } as any,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('returns zero totals and exactly 30 UTC days for a new user', async () => {
    const result = await service.getDashboard(42);

    expect(result.overview).toEqual({
      totalTimeSpentSeconds: 0,
      totalTimeSpentLabel: '0s',
      totalDocuments: 0,
      totalSessions: 0,
      createdSessions: 0,
      joinedSessions: 0,
    });
    expect(result.activity).toMatchObject({
      startDate: '2026-09-18',
      endDate: '2026-10-17',
      timeZone: 'UTC',
      totals: { documentsCreated: 0, aiRequests: 0 },
      maxDailyCount: 0,
    });
    expect(result.activity.days).toHaveLength(30);
    expect(result.activity.days.every((day) => day.documentsCreated === 0 && day.aiRequests === 0)).toBe(true);

    for (const builder of [memberships, documents, usages])
      expect(builder.where).toHaveBeenCalledWith('user.id = :userId', { userId: 42 });

    expect(documents.andWhere).toHaveBeenCalledWith(expect.stringContaining('document.createdAt'), {
      periodStart: '2026-09-18 00:00:00',
      periodEnd: '2026-10-18 00:00:00',
    });
    expect(usages.andWhere).toHaveBeenCalledWith(expect.stringContaining('usage.timestamp'), expect.any(Object));
  });

  it('aggregates counts, splits created/joined sessions and fills gaps without losing today', async () => {
    memberships.getRawOne.mockResolvedValue({
      totalTimeSpentSeconds: '55445.9',
      totalSessions: '8',
      createdSessions: '7',
    });
    documents.getCount.mockResolvedValue(12);
    documents.getRawMany.mockResolvedValue([
      { date: '2026-09-18', count: '2' },
      { date: '2026-10-17', count: '3' },
    ]);
    usages.getRawMany.mockResolvedValue([{ date: '2026-10-17', count: '9' }]);

    const result = await service.getDashboard(8);

    expect(result.overview).toEqual({
      totalTimeSpentSeconds: 55445,
      totalTimeSpentLabel: '15h 24m',
      totalDocuments: 12,
      totalSessions: 8,
      createdSessions: 7,
      joinedSessions: 1,
    });
    expect(result.activity.days[0]).toEqual({ date: '2026-09-18', documentsCreated: 2, aiRequests: 0 });
    expect(result.activity.days[1]).toEqual({ date: '2026-09-19', documentsCreated: 0, aiRequests: 0 });
    expect(result.activity.days[29]).toEqual({ date: '2026-10-17', documentsCreated: 3, aiRequests: 9 });
    expect(result.activity.totals).toEqual({ documentsCreated: 5, aiRequests: 9 });
    expect(result.activity.maxDailyCount).toBe(9);
    expect(memberships.setParameter).toHaveBeenCalledWith('adminPermission', '%,admin,%');
    expect(documents.addSelect).toHaveBeenCalledWith('COUNT(DISTINCT document.id)', 'count');
    expect(usages.addSelect).toHaveBeenCalledWith('COUNT(*)', 'count');
  });

  it.each([
    [65, '1m 5s'],
    [59, '59s'],
    [-3, '0s'],
    [3600, '1h 0m'],
  ])('formats %s recorded seconds as %s', async (seconds, label) => {
    memberships.getRawOne.mockResolvedValue({ totalTimeSpentSeconds: String(seconds) });
    expect((await service.getDashboard(1)).overview.totalTimeSpentLabel).toBe(label);
  });

  it('propagates database failures instead of returning misleading zero totals', async () => {
    documents.getCount.mockRejectedValue(new Error('database unavailable'));
    await expect(service.getDashboard(1)).rejects.toThrow('database unavailable');
  });
});
