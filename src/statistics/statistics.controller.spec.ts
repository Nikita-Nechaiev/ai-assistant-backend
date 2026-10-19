import { GUARDS_METADATA, HEADERS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { StatisticsController } from './statistics.controller';

describe('StatisticsController', () => {
  it('uses the authenticated user, regardless of a supplied query id', async () => {
    const result = { overview: { totalSessions: 0 } };
    const service = { getDashboard: jest.fn().mockResolvedValue(result) };
    const controller = new StatisticsController(service as any);

    await expect(controller.getDashboard({ user: { id: 23 }, query: { userId: '99' } } as any)).resolves.toBe(result);
    expect(service.getDashboard).toHaveBeenCalledWith(23);
  });
  it('requires JWT authentication and prevents caching private statistics', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, StatisticsController)).toContain(JwtAuthGuard);
    expect(Reflect.getMetadata(PATH_METADATA, StatisticsController)).toBe('statistics');
    expect(Reflect.getMetadata(HEADERS_METADATA, StatisticsController.prototype.getDashboard)).toContainEqual({
      name: 'Cache-Control',
      value: 'private, no-store',
    });
  });
});
