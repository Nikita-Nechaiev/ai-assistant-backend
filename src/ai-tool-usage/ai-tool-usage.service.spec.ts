import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiToolUsageService } from './ai-tool-usage.service';
import { AiToolUsage } from './ai-tool-usage.model';
import { AiTool } from 'src/common/enums/enums';

const repoFactory = () => ({
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
});

const makeCreate = () =>
  jest.fn().mockResolvedValue({
    choices: [{ message: { content: 'mocked text' } }],
  });

jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: makeCreate() } },
  })),
}));

describe('AiToolUsageService', () => {
  let svc: AiToolUsageService;
  let repo: jest.Mocked<Repository<AiToolUsage>>;

  const openAiMock = {
    chat: { completions: { create: makeCreate() } },
  };
  const createMock = openAiMock.chat.completions.create as unknown as jest.Mock;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'fake-key';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const module = await Test.createTestingModule({
      providers: [AiToolUsageService, { provide: getRepositoryToken(AiToolUsage), useFactory: repoFactory }],
    }).compile();

    svc = module.get(AiToolUsageService);
    repo = module.get(getRepositoryToken(AiToolUsage));

    (svc as any).openai = openAiMock;
  });

  afterEach(() => jest.clearAllMocks());

  describe('getUsageByUser', () => {
    const qb = (list: unknown[]) => {
      const chain = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(list),
      };

      return chain;
    };

    it('applies skip/take when search omitted', async () => {
      const builder = qb([{ id: 1 }]);

      repo.createQueryBuilder.mockReturnValue(builder as any);

      await svc.getUsageByUser(3, 2, 4);

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('usage');
      expect(builder.skip).toHaveBeenCalledWith(4);
      expect(builder.take).toHaveBeenCalledWith(4);
      expect(builder.andWhere).not.toHaveBeenCalled();
      expect(builder.getMany).toHaveBeenCalled();
    });

    it('adds andWhere when search term present', async () => {
      const builder = qb([]);

      repo.createQueryBuilder.mockReturnValue(builder as any);

      await svc.getUsageByUser(1, 1, 8, 'Test');

      expect(builder.andWhere).toHaveBeenCalledWith(expect.stringContaining('LOWER(usage.toolName) ILIKE'), {
        search: '%test%',
      });
    });
  });

  it('delegates getUsageByDocument to repository.find', async () => {
    repo.find.mockResolvedValue([{ id: 5 }] as any);

    await svc.getUsageByDocument(10);

    expect(repo.find).toHaveBeenCalledWith({
      where: { document: { id: 10 } },
    });
  });

  it('getMostFrequentAiTool returns correct stats and defaults', async () => {
    const now = new Date();

    repo.find.mockResolvedValueOnce([
      { toolName: AiTool.GRAMMAR_CHECK, result: 'foo bar', timestamp: now },
      { toolName: AiTool.GRAMMAR_CHECK, result: 'lorem ipsum', timestamp: now },
    ] as unknown as AiToolUsage[]);

    const stats = await svc.getMostFrequentAiTool(1);

    expect(stats).toMatchObject({
      mostFrequentTool: AiTool.GRAMMAR_CHECK,
      totalWordCount: 4,
      totalUsageNumber: 2,
    });

    repo.find.mockResolvedValueOnce([]);

    const empty = await svc.getMostFrequentAiTool(2);

    expect(empty.totalUsageNumber).toBe(0);
    expect(empty.mostFrequentTool).toBeNull();
  });

  it('translateText persists usage with documentId', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'bonjour' } }],
    });
    repo.save.mockImplementationOnce(async (u: AiToolUsage) => ({ ...u, id: 77 }));

    const saved = await svc.translateText(4, 'hello', 'fr', 90);

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: AiTool.TRANSLATION, document: { id: 90 } }),
    );
    expect(saved.id).toBe(77);
  });

  const wrappers: Array<[keyof AiToolUsageService, AiTool]> = [
    ['analyzeTone', AiTool.TONE_ANALYSIS],
    ['summarizeText', AiTool.SUMMARIZATION],
    ['rephraseText', AiTool.REPHRASE],
    ['extractKeywords', AiTool.KEYWORD_EXTRACTION],
    ['generateText', AiTool.TEXT_GENERATION],
    ['analyzeReadability', AiTool.READABILITY],
    ['generateTitle', AiTool.TITLE_GENERATION],
  ];

  it.each(wrappers)('%s invokes processAiTool with %s', async (method, tool) => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'ok' } }],
    });
    repo.save.mockResolvedValue({ id: 1 } as any);

    await (svc as any)[method](2, 'text');

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ toolName: tool, user: { id: 2 } }));
  });

  it('throws proper error message when OpenAI fails', async () => {
    createMock.mockRejectedValueOnce(new Error('boom'));

    await expect(svc.extractKeywords(1, 'txt')).rejects.toThrow(`${AiTool.KEYWORD_EXTRACTION} failed.`);
  });

  it('analyzeTextMetrics clamps values between 1 and 100', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ readabilityScore: 150, toneAnalysis: -3 }) } }],
    });

    const metrics = await svc.analyzeTextMetrics('lorem');

    expect(metrics).toEqual({ readabilityScore: 100, toneAnalysis: 1 });
  });

  it('analyzeTextMetrics rejects on malformed JSON', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'not-json' } }],
    });

    await expect(svc.analyzeTextMetrics('ipsum')).rejects.toThrow('Failed to analyze text metrics.');
  });

  it('cleanText collapses whitespace & strips escape chars', () => {
    expect((svc as any).cleanText('foo  \n  bar  \\ "baz"')).toBe('foo bar baz');
  });
});
