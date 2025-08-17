import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { Token } from './token.model';

const repoFactory = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

const jwtMock = {
  sign: jest.fn(),
  verify: jest.fn(),
};

describe('TokenService', () => {
  let service: TokenService;
  let repo: jest.Mocked<Repository<Token>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mod = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: getRepositoryToken(Token), useFactory: repoFactory },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = mod.get(TokenService);
    repo = mod.get(getRepositoryToken(Token));
  });

  it('generates access & refresh tokens with correct params', () => {
    jwtMock.sign.mockReturnValueOnce('acc').mockReturnValueOnce('ref');

    const payload = { sub: 1 };

    const res = service.generateTokens(payload);

    expect(jwtMock.sign).toHaveBeenNthCalledWith(1, payload, { expiresIn: '60m' });
    expect(jwtMock.sign).toHaveBeenNthCalledWith(2, payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '30d',
    });
    expect(res).toEqual({ accessToken: 'acc', refreshToken: 'ref' });
  });

  it('updates existing token row', async () => {
    repo.findOne.mockResolvedValue({ id: 3, userId: 5, refreshToken: 'old' } as Token);
    repo.save.mockResolvedValue({ id: 3 } as Token);

    await service.saveToken(5, 'newRef');

    expect(repo.save).toHaveBeenCalledWith({ id: 3, userId: 5, refreshToken: 'newRef' });
  });

  it('creates new token row when none exists', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.create.mockReturnValue({ userId: 6, refreshToken: 'r' } as Token);

    await service.saveToken(6, 'r');

    expect(repo.create).toHaveBeenCalledWith({ userId: 6, refreshToken: 'r' });
    expect(repo.save).toHaveBeenCalled();
  });

  it('delegates to repository.delete', async () => {
    repo.delete.mockResolvedValue({ affected: 1 } as any);

    await service.removeToken('dead');
    expect(repo.delete).toHaveBeenCalledWith({ refreshToken: 'dead' });
  });

  describe('validateRefreshToken', () => {
    it('returns payload when verify succeeds', () => {
      jwtMock.verify.mockReturnValue({ sub: 1 });

      expect(service.validateRefreshToken('ref')).toEqual({ sub: 1 });
    });

    it('returns null when verify throws', () => {
      jwtMock.verify.mockImplementation(() => {
        throw new Error('bad');
      });

      expect(service.validateRefreshToken('badRef')).toBeNull();
    });
  });

  describe('validateAccessToken', () => {
    it('returns payload when ok', () => {
      jwtMock.verify.mockReturnValue({ sub: 2 });
      expect(service.validateAccessToken('acc')).toEqual({ sub: 2 });
    });

    it('returns null when invalid', () => {
      jwtMock.verify.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(service.validateAccessToken('broken')).toBeNull();
    });
  });

  it('finds token by refreshToken', async () => {
    repo.findOne.mockResolvedValue({ id: 7 } as Token);

    const res = await service.findToken('xyz');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { refreshToken: 'xyz' } });
    expect(res).toEqual({ id: 7 });
  });
});
