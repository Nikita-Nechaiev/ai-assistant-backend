import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

process.env.JWT_ACCESS_SECRET = 'unit';
process.env.OPENAI_API_KEY = 'unit';
process.env.GOOGLE_CLIENT_ID = 'dummy-id';
process.env.GOOGLE_CLIENT_SECRET = 'dummy-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/google/cb';

jest.mock('openai', () => ({ default: jest.fn().mockImplementation(() => ({})) }));

jest.mock('@nestjs/typeorm', () => {
  const real = jest.requireActual('@nestjs/typeorm');
  const dyn = (prov = []) => ({ module: real.TypeOrmModule, providers: prov, exports: prov });

  return {
    ...real,
    TypeOrmModule: {
      ...real.TypeOrmModule,
      forRoot: jest.fn(() => dyn()),
      forFeature: jest.fn((ents: any[] = []) =>
        dyn(
          ents.map((e) => ({
            provide: getRepositoryToken(e),
            useValue: {},
          })),
        ),
      ),
    },
  };
});

jest.mock('@nestjs/jwt', () => {
  const real = jest.requireActual('@nestjs/jwt');

  return {
    ...real,
    JwtModule: { ...real.JwtModule, registerAsync: jest.fn(() => ({ module: real.JwtModule })) },
  };
});
jest.mock('@nestjs/passport', () => {
  const real = jest.requireActual('@nestjs/passport');

  return {
    ...real,
    PassportModule: { ...real.PassportModule, register: jest.fn(() => ({ module: real.PassportModule })) },
  };
});

class TokenServiceStub {
  generateTokens() {
    return { accessToken: 'a', refreshToken: 'r' };
  }
}

@Module({
  providers: [TokenServiceStub],
  exports: [TokenServiceStub],
})
class TokenModuleStub {}

jest.mock('src/token/token.module', () => ({ TokenModule: TokenModuleStub }));
jest.mock('src/token/token.service', () => ({ TokenService: TokenServiceStub }));

import { AppModule } from './app.module';

describe('AppModule', () => {
  it('compiles with all sub-modules wired up', async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(mod).toBeDefined();
  }, 10_000);
});
