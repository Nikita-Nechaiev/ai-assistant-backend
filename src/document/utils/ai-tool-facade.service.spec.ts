import { Test } from '@nestjs/testing';
import { AiToolFacadeService } from './ai-tool-facade.service';
import { AiToolUsageService } from 'src/ai-tool-usage/ai-tool-usage.service';
import { AiTool } from 'src/common/enums/enums';

const mockUsage = {
  checkGrammar: jest.fn(),
  analyzeTone: jest.fn(),
  summarizeText: jest.fn(),
  rephraseText: jest.fn(),
  translateText: jest.fn(),
  extractKeywords: jest.fn(),
  generateText: jest.fn(),
  analyzeReadability: jest.fn(),
  generateTitle: jest.fn(),
  getUsageByDocument: jest.fn(),
};

describe('AiToolFacadeService', () => {
  let facade: AiToolFacadeService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      providers: [AiToolFacadeService, { provide: AiToolUsageService, useValue: mockUsage }],
    }).compile();

    facade = mod.get(AiToolFacadeService);
  });

  afterEach(() => jest.clearAllMocks());

  const cases: [AiTool, keyof typeof mockUsage, any[]][] = [
    [AiTool.GRAMMAR_CHECK, 'checkGrammar', [1, 'txt', 7]],
    [AiTool.TONE_ANALYSIS, 'analyzeTone', [1, 'txt', 7]],
    [AiTool.SUMMARIZATION, 'summarizeText', [1, 'txt', 7]],
    [AiTool.REPHRASE, 'rephraseText', [1, 'txt', 7]],
    [AiTool.TRANSLATION, 'translateText', [1, 'txt', 'fr', 7]],
    [AiTool.KEYWORD_EXTRACTION, 'extractKeywords', [1, 'txt', 7]],
    [AiTool.TEXT_GENERATION, 'generateText', [1, 'txt', 7]],
    [AiTool.READABILITY, 'analyzeReadability', [1, 'txt', 7]],
    [AiTool.TITLE_GENERATION, 'generateTitle', [1, 'txt', 7]],
    [AiTool.USAGE, 'getUsageByDocument', [7]],
  ];

  it.each(cases)('%s delegates to %s', async (tool, method, expectedArgs) => {
    (mockUsage[method] as jest.Mock).mockResolvedValue('res');

    const data =
      tool === AiTool.TRANSLATION
        ? { toolName: tool, text: 'txt', documentId: 7, targetLanguage: 'fr' }
        : { toolName: tool, text: 'txt', documentId: 7 };

    const out = await facade.executeTool(1, data as any);

    expect(mockUsage[method]).toHaveBeenCalledWith(...expectedArgs);
    expect(out).toBe('res');
  });

  it('throws when translation has no target language', async () => {
    await expect(
      facade.executeTool(1, { toolName: AiTool.TRANSLATION, text: 'x', documentId: 5 } as any),
    ).rejects.toThrow('targetLanguage is required');
  });

  it('throws on unsupported tool', async () => {
    // @ts-expect-error – intentionally wrong enum
    await expect(facade.executeTool(1, { toolName: 'BAD', text: '', documentId: 1 })).rejects.toThrow(
      'Unsupported tool name',
    );
  });
});
