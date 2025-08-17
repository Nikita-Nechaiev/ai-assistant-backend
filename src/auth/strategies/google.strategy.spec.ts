import { GoogleStrategy } from './google.strategy';
import { UsersService } from 'src/user/users.service';
import { VerifyCallback } from 'passport-google-oauth20';

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost/google/callback';
});

describe('GoogleStrategy', () => {
  const usersService = {
    findOrCreateGoogleUser: jest.fn(),
  } as unknown as UsersService;

  let strategy: GoogleStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new GoogleStrategy(usersService);
  });

  it('validate → calls service and passes user to done', async () => {
    const fakeUser = { id: 1, email: 'john@mail' };

    (usersService.findOrCreateGoogleUser as jest.Mock).mockResolvedValue(fakeUser);

    const profile = {
      id: 'google-id',
      displayName: 'John Doe',
      emails: [{ value: 'john@mail' }],
      _json: { picture: 'pic-url' },
    };

    const done = jest.fn() as unknown as VerifyCallback;

    await strategy.validate('acTok', 'refTok', profile as any, done);

    expect(usersService.findOrCreateGoogleUser).toHaveBeenCalledWith('google-id', 'john@mail', 'John Doe', 'pic-url');
    expect(done).toHaveBeenCalledWith(null, fakeUser);
  });

  it('validate → propagates error if service fails', async () => {
    const boom = new Error('db down');

    (usersService.findOrCreateGoogleUser as jest.Mock).mockRejectedValue(boom);

    const profile = {
      id: 'x',
      displayName: 'Y',
      emails: [{ value: 'y@mail' }],
      _json: { picture: 'zzz' },
    };

    const done = jest.fn() as unknown as VerifyCallback;

    await expect(strategy.validate('', '', profile as any, done)).rejects.toThrow('db down');
    expect(done).not.toHaveBeenCalled();
  });
});
