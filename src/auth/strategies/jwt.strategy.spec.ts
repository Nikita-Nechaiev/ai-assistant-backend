import { JwtStrategy } from './jwt.strategy';
import { UsersService } from 'src/user/users.service';
import { UnauthorizedException } from '@nestjs/common';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = 'test-secret';
});

describe('JwtStrategy', () => {
  const usersService = {
    findById: jest.fn(),
  } as unknown as UsersService;

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(usersService);
  });

  it('validate → returns user if found', async () => {
    const fakeUser = { id: 7, email: 'a@mail' };

    (usersService.findById as jest.Mock).mockResolvedValue(fakeUser);

    const result = await strategy.validate({ sub: 7 });

    expect(usersService.findById).toHaveBeenCalledWith(7);
    expect(result).toBe(fakeUser);
  });

  it('validate → throws UnauthorizedException if user not found', async () => {
    (usersService.findById as jest.Mock).mockResolvedValue(null);

    await expect(strategy.validate({ sub: 9 })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
