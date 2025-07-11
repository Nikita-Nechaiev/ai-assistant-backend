/* ------------------------------------------------------------------ */
/* ai-tool-usage.controller.spec.ts – полный файл с расширенным       */
/* покрытием (ветки с documentId теперь тестируются)                  */
/* ------------------------------------------------------------------ */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AiToolUsageController } from './ai-tool-usage.controller';
import { AiToolUsageService } from './ai-tool-usage.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

/* ------------------------------------------------------------------ */
/* Моки                                                                */
/* ------------------------------------------------------------------ */
const mockService = {
  getUsageByUser: jest.fn(),
  getMostFrequentAiTool: jest.fn(),
  getUsageByDocument: jest.fn(),
  checkGrammar: jest.fn(),
  analyzeTone: jest.fn(),
  summarizeText: jest.fn(),
  rephraseText: jest.fn(),
  translateText: jest.fn(),
  extractKeywords: jest.fn(),
  generateText: jest.fn(),
  analyzeReadability: jest.fn(),
  generateTitle: jest.fn(),
};

class MockJwtAuthGuard {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();

    req.user = { id: 42 }; // подставляем тестового пользователя

    return true;
  }
}

describe('AiToolUsageController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiToolUsageController],
      providers: [{ provide: AiToolUsageService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  /* ------------------------------------------------------------------ */
  /*  GET-маршруты                                                      */
  /* ------------------------------------------------------------------ */
  describe('GET /ai-tool-usage/user', () => {
    it('returns usage for current user', async () => {
      mockService.getUsageByUser.mockResolvedValueOnce(['usage1']);

      await request(app.getHttpServer()).get('/ai-tool-usage/user?page=2&limit=5').expect(200).expect(['usage1']);

      expect(mockService.getUsageByUser).toHaveBeenCalledWith(42, 2, 5, undefined);
    });

    it('handles search parameter', async () => {
      mockService.getUsageByUser.mockResolvedValueOnce(['filtered']);

      await request(app.getHttpServer()).get('/ai-tool-usage/user?search=test').expect(200);

      expect(mockService.getUsageByUser).toHaveBeenCalledWith(42, 1, 8, 'test');
    });
  });

  it('GET /user/most-used-tool returns stats', async () => {
    mockService.getMostFrequentAiTool.mockResolvedValueOnce({ mostFrequentTool: 'GRAMMAR' });

    await request(app.getHttpServer())
      .get('/ai-tool-usage/user/most-used-tool')
      .expect(200)
      .expect({ mostFrequentTool: 'GRAMMAR' });

    expect(mockService.getMostFrequentAiTool).toHaveBeenCalledWith(42);
  });

  it('GET /document/:id returns usage for document', async () => {
    mockService.getUsageByDocument.mockResolvedValueOnce(['doc-usage']);

    await request(app.getHttpServer()).get('/ai-tool-usage/document/99').expect(200).expect(['doc-usage']);

    expect(mockService.getUsageByDocument).toHaveBeenCalledWith(99);
  });

  /* ------------------------------------------------------------------ */
  /*  POST-маршруты без documentId                                      */
  /* ------------------------------------------------------------------ */
  it.each([
    ['grammar-check', 'checkGrammar'],
    ['tone-analysis', 'analyzeTone'],
    ['summarization', 'summarizeText'],
    ['rephrase', 'rephraseText'],
    ['translation', 'translateText'],
    ['keyword-extraction', 'extractKeywords'],
    ['text-generation', 'generateText'],
    ['readability-analysis', 'analyzeReadability'],
    ['title-generation', 'generateTitle'],
  ])('POST /%s calls %s (без documentId)', async (route, method) => {
    mockService[method].mockResolvedValueOnce({ id: 1 });

    const payload = route === 'translation' ? { text: 'hello', targetLanguage: 'fr' } : { text: 'hello' };

    await request(app.getHttpServer()).post(`/ai-tool-usage/${route}`).send(payload).expect(201).expect({ id: 1 });

    if (route === 'translation') expect(mockService[method]).toHaveBeenCalledWith(42, 'hello', 'fr', undefined);
    else expect(mockService[method]).toHaveBeenCalledWith(42, 'hello', undefined);
  });

  /* ------------------------------------------------------------------ */
  /*  🆕  POST-маршруты С documentId                                    */
  /* ------------------------------------------------------------------ */
  it.each([
    ['grammar-check', 'checkGrammar'],
    ['tone-analysis', 'analyzeTone'],
    ['summarization', 'summarizeText'],
    ['rephrase', 'rephraseText'],
    ['translation', 'translateText'],
    ['keyword-extraction', 'extractKeywords'],
    ['text-generation', 'generateText'],
    ['readability-analysis', 'analyzeReadability'],
    ['title-generation', 'generateTitle'],
  ])('POST /%s/:documentId calls %s with doc id', async (route, method) => {
    mockService[method].mockResolvedValueOnce({ id: 2 });

    const payload = route === 'translation' ? { text: 'hello', targetLanguage: 'de' } : { text: 'hello' };

    await request(app.getHttpServer()).post(`/ai-tool-usage/${route}/55`).send(payload).expect(201).expect({ id: 2 });

    if (route === 'translation') expect(mockService[method]).toHaveBeenCalledWith(42, 'hello', 'de', 55);
    else expect(mockService[method]).toHaveBeenCalledWith(42, 'hello', 55);
  });
});
