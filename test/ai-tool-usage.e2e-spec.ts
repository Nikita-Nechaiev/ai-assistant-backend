import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';
import { AiToolUsageService } from 'src/ai-tool-usage/ai-tool-usage.service';
import { AiTool } from 'src/common/enums/enums';
import { AiToolUsage } from 'src/ai-tool-usage/ai-tool-usage.model';

const fakeUsageRecord: AiToolUsage = Object.assign(new AiToolUsage(), {
  id: 1,
  toolName: AiTool.GRAMMAR_CHECK,
  sentText: 'teh quick brown fox',
  result: 'the quick brown fox',
  timestamp: new Date(),
});

const aiToolStub: Partial<AiToolUsageService> = {
  getUsageByUser: async () => [fakeUsageRecord],
  getMostFrequentAiTool: async () => ({
    mostFrequentTool: AiTool.GRAMMAR_CHECK,
    totalUsageNumber: 7,
    totalWordCount: 42,
    mostInDayUsage: new Date('2025-01-01'),
    firstAiUsage: new Date('2024-12-31'),
  }),
  checkGrammar: async () => fakeUsageRecord,
};

describe('Ai-tool-usage module (e2e)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  let accessCookie = '';
  let refreshCookie = '';

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiToolUsageService)
      .useValue(aiToolStub)
      .compile();

    app = modRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.use(cookieParser());
    await app.init();

    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => app.close());

  const ts = Date.now();
  const user = {
    email: `e2e_ai_${ts}@mail.com`,
    name: `e2e_ai_${ts}`,
    password: 'Str0ngP@ssw0rd!5',
  };

  beforeAll(async () => {
    const img = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUTEhAVFRUVFRUVFRUVFRUVFRUVFRUWFhUV' +
        'FRUYHSggGBolHRUWITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0t',
      'base64',
    );

    await agent
      .post('/auth/register')
      .field('email', user.email)
      .field('name', user.name)
      .field('password', user.password)
      .attach('avatar', img, 'avatar.jpg')
      .expect(201);

    const loginRes = await agent.post('/auth/login').send({ email: user.email, password: user.password }).expect(200);

    const raw = loginRes.headers['set-cookie'] ?? [];
    const cookies = Array.isArray(raw) ? raw : [raw];

    accessCookie = cookies.find((c) => c.startsWith('accessToken='))!;
    refreshCookie = cookies.find((c) => c.startsWith('refreshToken='))!;
  });

  const authCookies = () => `${accessCookie}; ${refreshCookie}`;

  it('GET /ai-tool-usage/user returns usage list', async () => {
    const res = await agent.get('/ai-tool-usage/user').set('Cookie', authCookies()).expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({
        id: fakeUsageRecord.id,
        toolName: fakeUsageRecord.toolName,
        sentText: fakeUsageRecord.sentText,
        result: fakeUsageRecord.result,
      }),
    ]);
  });

  it('GET /ai-tool-usage/user/most-used-tool returns stats', async () => {
    const res = await agent.get('/ai-tool-usage/user/most-used-tool').set('Cookie', authCookies()).expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        mostFrequentTool: AiTool.GRAMMAR_CHECK,
        totalUsageNumber: 7,
      }),
    );
  });

  it('POST /ai-tool-usage/grammar-check returns corrected text', async () => {
    const res = await agent
      .post('/ai-tool-usage/grammar-check')
      .set('Cookie', authCookies())
      .send({ text: 'teh quick brown fox' })
      .expect(201);

    expect(res.body.result).toBe('the quick brown fox');
    expect(res.body.toolName).toBe(AiTool.GRAMMAR_CHECK);
  });

  it('unauthenticated request is rejected with 401', async () => {
    await agent.get('/ai-tool-usage/user').expect(401);
  });
});
