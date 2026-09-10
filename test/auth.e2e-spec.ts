import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';

describe('Auth module (e2e)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  let refreshCookie = '';

  const captureRefreshCookie = (res: request.Response) => {
    const raw = res.headers['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : [raw ?? ''];
    const nextRefreshCookie = cookies.find((c) => c.startsWith('refreshToken='));

    if (nextRefreshCookie) {
      refreshCookie = nextRefreshCookie.split(';')[0];
    }
  };

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

  afterAll(() => app?.close());

  const now = Date.now();
  const user = {
    email: `e2e_${now}@mail.com`,
    name: `e2e_${now}`,
    password: 'Str0ngP@ssw0rd!1',
  };

  it('POST /auth/register → 201 & sets refresh cookie', async () => {
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

    captureRefreshCookie(res);

    expect(res.body.user.email).toBe(user.email);
  });

  it('POST /auth/login → 200', async () => {
    const res = await agent.post('/auth/login').send({ email: user.email, password: user.password }).expect(200);

    captureRefreshCookie(res);
  });

  it('GET /auth/me → 200', async () => {
    await agent.get('/auth/me').expect(200);
  });

  it('POST /auth/refresh → 200', async () => {
    const res = await agent.post('/auth/refresh').set('Cookie', refreshCookie).expect(200);

    captureRefreshCookie(res);
  });

  it('POST /auth/refresh-cookies → 200', async () => {
    const res = await agent.post('/auth/refresh-cookies').set('Cookie', refreshCookie).expect(200);

    captureRefreshCookie(res);
  });

  it('POST /auth/logout → 200', async () => {
    await agent.post('/auth/logout').set('Cookie', refreshCookie).expect(200);
  });
});
