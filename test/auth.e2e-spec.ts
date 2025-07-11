// test/auth.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';

describe('Auth module (e2e)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  /* captured cookies */
  let refreshCookie = '';

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.use(cookieParser()); // ← essential
    await app.init();

    agent = request.agent(app.getHttpServer());
  });

  afterAll(() => app.close());

  /* DTO-compliant user */
  const now = Date.now();
  const user = {
    email: `e2e_${now}@mail.com`,
    name: `e2e_${now}`,
    password: 'Str0ngP@ssw0rd!1', // passes regex
  };

  /* ───── 1. register ───── */
  it('POST /auth/register → 201 & sets refresh cookie', async () => {
    // 1-kB valid JPEG header to satisfy Multer/fileService
    const fakeJpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUTEhAVFRUVFRUVFRUVFRUVFRUVFRUWFhUV' +
        'FRUYHSggGBolHRUWITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0t' +
        'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tK//AABEIAKgBLAMBIgACEQEDEQH/' +
        'xAAbAAABBQEBAAAAAAAAAAAAAAAFAQIDBAYAB//EADkQAAIBAwMCBAQFAwMFAQAAAAECAwAEEQUS' +
        'ITFBEyJRYXEGMoGRBzKRobHB8BYjQlJy0SRSU2KCkqKy4f/EABkBAAMBAQEAAAAAAAAAAAAAAAAB' +
        'AgMEBf/EACIRAQACAgICAgMBAAAAAAAAAAABAgMRITESQRMiUWGBBf/aAAwDAQACEQMRAD8A9/i0',
      'base64',
    );

    const res = await agent
      .post('/auth/register')
      .field('email', user.email)
      .field('name', user.name)
      .field('password', user.password)
      .attach('avatar', fakeJpeg, 'avatar.jpg')
      .expect(201);

    const raw = res.headers['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : [raw ?? ''];

    refreshCookie = cookies.find((c) => c.startsWith('refreshToken='))!;

    expect(res.body.user.email).toBe(user.email);
  });

  /* ───── 2. login ───── */
  it('POST /auth/login → 200', async () => {
    await agent.post('/auth/login').send({ email: user.email, password: user.password }).expect(200);
    // cookies persist in supertest-agent
  });

  /* ───── 3. get-tokens ───── */
  it('GET /auth/get-tokens → 200', async () => {
    await agent.get('/auth/get-tokens').set('Cookie', refreshCookie).expect(200);
  });

  /* ───── 4. refresh-cookies ───── */
  it('GET /auth/refresh-cookies → 200', async () => {
    await agent.get('/auth/refresh-cookies').set('Cookie', refreshCookie).expect(200);
  });

  /* ───── 5. logout ───── */
  it('POST /auth/logout → 200', async () => {
    await agent.post('/auth/logout').set('Cookie', refreshCookie).expect(200);
  });
});
