import * as cookieParser from 'cookie-parser';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

process.env.FRONTEND_URL = 'http://localhost:3000';

const mockAuthService = {
  login: jest.fn().mockResolvedValue({
    accessToken: 'access-x',
    refreshToken: 'refresh-x',
    user: { id: 1 },
  }),
  register: jest.fn().mockResolvedValue({
    accessToken: 'access-r',
    refreshToken: 'refresh-r',
    user: { id: 2 },
  }),
  logout: jest.fn(),
  refresh: jest.fn().mockResolvedValue({
    refreshToken: 'refresh-n',
    accessToken: 'access-n',
    user: { id: 1 },
  }),
  sendResetPasswordLink: jest.fn().mockResolvedValue({ ok: true }),
  resetPassword: jest.fn().mockResolvedValue({ ok: true }),
  oauthLogin: jest.fn().mockResolvedValue({
    accessToken: 'oauth-a',
    refreshToken: 'oauth-r',
  }),
};

/* ─── custom stub guard that injects req.user ─── */
class MockGoogleGuard {
  canActivate(ctx: any) {
    const req = ctx.switchToHttp().getRequest();

    req.user = { sub: 99 }; // whatever payload you need

    return true;
  }
}

describe('AuthController e2e-style', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(AuthGuard('google'))
      .useClass(MockGoogleGuard)
      .compile();

    app = mod.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /* ───────── login ───────── */
  it('POST /auth/login sets cookies and returns token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@mail.com', password: 'password123' })
      .expect(200);

    expect(mockAuthService.login).toHaveBeenCalled();
    expect(res.body).toEqual({ accessToken: 'access-x', user: { id: 1 } });
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('refreshToken=refresh-x'),
        expect.stringContaining('accessToken=access-x'),
      ]),
    );
  });

  /* ───────── register – branch WITH accessToken ───────── */
  it('POST /auth/register returns user and sets both cookies (access + refresh)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .field('name', 'Jon')
      .field('email', 'new@mail.com')
      .field('password', 'Password1!')
      .expect(201);

    expect(mockAuthService.register).toHaveBeenCalled();
    expect(res.body).toEqual({ user: { id: 2 } });
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('refreshToken=refresh-r'),
        expect.stringContaining('accessToken=access-r'),
      ]),
    );
  });

  /* ───────── logout paths ───────── */
  it('POST /auth/logout clears cookies', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', ['refreshToken=refresh-x'])
      .expect(200)
      .expect(({ body, headers }) => {
        expect(body).toEqual({ message: 'Logged out successfully' });
        expect(headers['set-cookie']).toEqual(
          expect.arrayContaining([expect.stringContaining('refreshToken='), expect.stringContaining('accessToken=')]),
        );
        expect(mockAuthService.logout).toHaveBeenCalledWith('refresh-x');
      });
  });

  it('POST /auth/logout with no cookie → 401', async () => {
    await request(app.getHttpServer()).post('/auth/logout').expect(401);
  });

  /* ───────── refresh-cookies paths ───────── */
  it('GET /auth/refresh-cookies issues new cookies', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/refresh-cookies')
      .set('Cookie', ['refreshToken=refresh-old'])
      .expect(200);

    expect(mockAuthService.refresh).toHaveBeenCalledWith('refresh-old');
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('refreshToken=refresh-n'),
        expect.stringContaining('accessToken=access-n'),
      ]),
    );
  });

  it('GET /auth/refresh-cookies without cookie → 401', async () => {
    await request(app.getHttpServer()).get('/auth/refresh-cookies').expect(401);
  });

  /* ───────── get-tokens paths ───────── */
  it('GET /auth/get-tokens returns tokens & user', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/get-tokens')
      .set('Cookie', ['refreshToken=refresh-old'])
      .expect(200);

    expect(res.body).toEqual({
      accessToken: 'access-n',
      newRefreshToken: 'refresh-n',
      user: { id: 1 },
    });
  });

  it('GET /auth/get-tokens without cookie → 401', async () => {
    await request(app.getHttpServer()).get('/auth/get-tokens').expect(401);
  });

  /* ───────── forgot / reset pwd ───────── */
  it('POST /auth/forgot-password triggers email send', async () => {
    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: 'x@mail.com' }).expect(200);

    expect(mockAuthService.sendResetPasswordLink).toHaveBeenCalledWith('x@mail.com');
  });

  it('POST /auth/reset-password/:token resets password', async () => {
    await request(app.getHttpServer()).post('/auth/reset-password/tkn').send({ password: 'Password1!' }).expect(200);

    expect(mockAuthService.resetPassword).toHaveBeenCalledWith('tkn', { password: 'Password1!' });
  });

  /* ───────── Google callback success ───────── */
  it('GET /auth/google/callback redirects to dashboard on success', async () => {
    mockAuthService.oauthLogin.mockResolvedValueOnce({
      accessToken: 'oa',
      refreshToken: 'or',
    });

    const res = await request(app.getHttpServer()).get('/auth/google/callback').expect(302);

    expect(mockAuthService.oauthLogin).toHaveBeenCalled();
    expect(res.headers.location).toBe('http://localhost:3000/dashboard');
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refreshToken=or'), expect.stringContaining('accessToken=oa')]),
    );
  });

  it('GET /auth/google/callback redirects to /login on error', async () => {
    mockAuthService.oauthLogin.mockRejectedValueOnce(new Error('boom'));

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app.getHttpServer()).get('/auth/google/callback').expect(302);

    expect(res.headers.location).toBe('http://localhost:3000/login');

    spy.mockRestore();
  });
});
