import { Test } from '@nestjs/testing';
import { TokenModule } from './token.module';
import { TokenService } from './token.service';
import { JwtService } from '@nestjs/jwt';

describe('TokenModule', () => {
  it('should compile and provide TokenService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TokenModule],
    })
      .overrideProvider('TokenRepository')
      .useValue({}) // мок репозитория
      .overrideProvider(JwtService)
      .useValue({ sign: jest.fn(), verify: jest.fn() }) // мок jwt
      .compile();

    const service = moduleRef.get(TokenService);

    expect(service).toBeInstanceOf(TokenService);
  });
});
