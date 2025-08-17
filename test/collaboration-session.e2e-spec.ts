import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';

describe('Collaboration-session module (e2e)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  let accessCookie = '';
  let refreshCookie = '';

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.use(cookieParser());
    await app.init();

    agent = request.agent(app.getHttpServer());
  });

  afterAll(() => app.close());

  const now = Date.now();
  const user = {
    email: `e2e_cs_${now}@mail.com`,
    name: `e2e_cs_${now}`,
    password: 'Str0ngP@ssw0rd!2',
  };

  it('registers & logs in', async () => {
    const fakeJpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUTEhAVFRUVFRUVFRUVFRUVFRUVFRUWFhUV' +
        'FRUYHSggGBolHRUWITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0t' +
        'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tK//AABEIAKgBLAMBIgACEQEDEQH/',
      'base64',
    );

    await agent
      .post('/auth/register')
      .field('email', user.email)
      .field('name', user.name)
      .field('password', user.password)
      .attach('avatar', fakeJpeg, 'avatar.jpg')
      .expect(201);

    const loginRes = await agent.post('/auth/login').send({ email: user.email, password: user.password }).expect(200);

    const raw = loginRes.headers['set-cookie'] ?? [];
    const cookies = Array.isArray(raw) ? raw : [raw];

    accessCookie = cookies.find((c) => c.startsWith('accessToken='))!;
    refreshCookie = cookies.find((c) => c.startsWith('refreshToken='))!;

    expect(accessCookie).toBeDefined();
  });

  const authCookies = () => `${accessCookie}; ${refreshCookie}`;

  let sessionId: number;

  it('POST /collaboration-session/create → 201', async () => {
    const res = await agent
      .post('/collaboration-session/create')
      .set('Cookie', authCookies())
      .send({ name: 'Test session' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test session');
    sessionId = res.body.id;
  });

  it('GET /collaboration-session/get-user-sessions includes new session', async () => {
    const res = await agent
      .get('/collaboration-session/get-user-sessions')
      .set('Cookie', authCookies())
      .query({ page: 1 })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((s: any) => s.id === sessionId)).toBe(true);
  });

  it('GET /collaboration-session/get-user-sessions?search=miss returns []', async () => {
    const res = await agent
      .get('/collaboration-session/get-user-sessions')
      .set('Cookie', authCookies())
      .query({ page: 1, search: 'no-such-name' })
      .expect(200);

    expect(res.body.length).toBe(0);
  });

  it('GET /collaboration-session/get-user-sessions?page=0 → 400', async () => {
    await agent
      .get('/collaboration-session/get-user-sessions')
      .set('Cookie', authCookies())
      .query({ page: 0 })
      .expect(400);
  });
});
