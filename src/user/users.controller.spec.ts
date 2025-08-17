import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { APP_INTERCEPTOR } from '@nestjs/core';

const mockUsersService = {
  getAllUsers: jest.fn().mockResolvedValue([{ id: 1 }]),
  updateProfile: jest.fn().mockResolvedValue({ id: 42, name: 'Jon' }),
};

class MockJwtAuthGuard {
  canActivate(ctx: ExecutionContext) {
    ctx.switchToHttp().getRequest().user = { id: 99 };

    return true;
  }
}

describe('UsersController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: APP_INTERCEPTOR, useClass: class {} },
      ],
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

  it('returns all users', async () => {
    const res = await request(app.getHttpServer()).get('/users/all-users').expect(200);

    expect(mockUsersService.getAllUsers).toHaveBeenCalled();
    expect(res.body).toEqual([{ id: 1 }]);
  });

  it('updates profile and returns message + user', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/profile')
      .field('name', 'Jon')
      .attach('avatar', Buffer.from('dummy'), { filename: 'pic.png' })
      .expect(200);

    expect(mockUsersService.updateProfile).toHaveBeenCalledWith(99, { name: 'Jon' }, expect.any(Object));
    expect(res.body).toEqual({
      message: 'Profile updated',
      user: { id: 42, name: 'Jon' },
    });
  });
});
