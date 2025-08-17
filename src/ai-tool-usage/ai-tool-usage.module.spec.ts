import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  })),
}));

jest.mock('@nestjs/typeorm', () => {
  const actual = jest.requireActual('@nestjs/typeorm');

  const forFeature = jest.fn().mockImplementation((entities: any[] = []) => {
    const providers = entities.map((e) => ({
      provide: getRepositoryToken(e),
      useValue: {},
    }));

    return { module: actual.TypeOrmModule, providers, exports: providers };
  });

  return {
    ...actual,
    TypeOrmModule: { ...actual.TypeOrmModule, forFeature },
  };
});

import { AiToolUsageModule } from './ai-tool-usage.module';
import { AiToolUsageService } from './ai-tool-usage.service';
import { AiToolUsageController } from './ai-tool-usage.controller';

describe('AiToolUsageModule', () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('compiles and exposes service & controller', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AiToolUsageModule],
    }).compile();

    expect(moduleRef.get(AiToolUsageService)).toBeDefined();
    expect(moduleRef.get(AiToolUsageController)).toBeDefined();
  });
});
