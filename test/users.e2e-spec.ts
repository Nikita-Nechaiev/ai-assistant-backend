// test/users.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';

describe('Users module (e2e)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  /* cookies for the authenticated user */
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

  /* ────────── bootstrap user (register → login) ────────── */
  const ts = Date.now();
  const user = {
    email: `e2e_user_${ts}@mail.com`,
    name: `e2e_user_${ts}`,
    password: 'Str0ngP@ssw0rd!3',
  };

  beforeAll(async () => {
    /* register */
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

    /* login */
    const loginRes = await agent.post('/auth/login').send({ email: user.email, password: user.password }).expect(200);

    const raw = loginRes.headers['set-cookie'] ?? [];
    const cookies = Array.isArray(raw) ? raw : [raw];

    accessCookie = cookies.find((c) => c.startsWith('accessToken='))!;
    refreshCookie = cookies.find((c) => c.startsWith('refreshToken='))!;
  });

  /* helper */
  const authCookies = () => `${accessCookie}; ${refreshCookie}`;

  /* ─────────────────── tests ─────────────────── */

  it('GET /users/all-users → returns at least one user', async () => {
    const res = await agent.get('/users/all-users').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    // make sure our user is present
    const me = res.body.find((u: any) => u.email === user.email);

    expect(me).toBeDefined();
  });

  it('PATCH /users/profile (unauthenticated) → 401', async () => {
    await agent.patch('/users/profile').send({ name: 'Should fail' }).expect(401);
  });

  it('PATCH /users/profile (authenticated) → 200 & updates fields', async () => {
    const res = await agent
      .patch('/users/profile')
      .set('Cookie', authCookies())
      .field('name', 'Updated Name')
      .attach('avatar', Buffer.from([0xff, 0xd8, 0xff]), 'avatar.jpg') // tiny JPEG header
      .expect(200);

    expect(res.body.message).toBe('Profile updated');
    expect(res.body.user.name).toBe('Updated Name');
  });
});
