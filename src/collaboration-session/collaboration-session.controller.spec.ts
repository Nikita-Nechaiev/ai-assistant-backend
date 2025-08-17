import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { CollaborationSessionController } from './collaboration-session.controller';
import { CollaborationSessionService } from './collaboration-session.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

const mockService = {
  getUserSessions: jest.fn(),
  createSession: jest.fn(),
};

class MockJwtAuthGuard {
  canActivate(ctx: ExecutionContext) {
    ctx.switchToHttp().getRequest().user = { id: 11 };

    return true;
  }
}

describe('CollaborationSessionController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollaborationSessionController],
      providers: [{ provide: CollaborationSessionService, useValue: mockService }],
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

  it('returns user sessions (default page)', async () => {
    mockService.getUserSessions.mockResolvedValueOnce(['s1']);

    await request(app.getHttpServer()).get('/collaboration-session/get-user-sessions').expect(200).expect(['s1']);

    expect(mockService.getUserSessions).toHaveBeenCalledWith(11, 0, 25, undefined);
  });

  it('accepts page and search params', async () => {
    mockService.getUserSessions.mockResolvedValueOnce(['s2']);

    await request(app.getHttpServer()).get('/collaboration-session/get-user-sessions?page=2&search=hello').expect(200);

    expect(mockService.getUserSessions).toHaveBeenCalledWith(11, 25, 25, 'hello');
  });

  it('rejects invalid page value', async () => {
    await request(app.getHttpServer()).get('/collaboration-session/get-user-sessions?page=0').expect(400);

    await request(app.getHttpServer()).get('/collaboration-session/get-user-sessions?page=abc').expect(400);
  });

  it('creates new session for current user', async () => {
    mockService.createSession.mockResolvedValueOnce({ id: 3, name: 'New' });

    await request(app.getHttpServer())
      .post('/collaboration-session/create')
      .send({ name: 'New' })
      .expect(201)
      .expect({ id: 3, name: 'New' });

    expect(mockService.createSession).toHaveBeenCalledWith(11, 'New');
  });
});
