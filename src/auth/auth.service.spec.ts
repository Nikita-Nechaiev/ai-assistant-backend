import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { UsersService } from 'src/user/users.service';
import { FileService } from 'src/file/file.service';
import { EmailService } from 'src/email/email.service';
import { TokenService } from 'src/token/token.service';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';

const userFixture = {
  id: 1,
  email: 'u@mail.com',
  name: 'User',
  passwordHash: 'hashed',
  avatar: '/img.png',
} as any;

const usersMock = {
  findByEmail: jest.fn(),
  createUser: jest.fn(),
  findById: jest.fn(),
  updateResetToken: jest.fn(),
  findByResetToken: jest.fn(),
  updatePassword: jest.fn(),
  findOrCreateGoogleUser: jest.fn(),
};
const fileMock = { saveAvatarFile: jest.fn().mockResolvedValue('/img.png') };
const emailMock = { sendResetPasswordEmail: jest.fn() };
const tokenMock = {
  generateTokens: jest.fn().mockReturnValue({ accessToken: 'acc', refreshToken: 'ref' }),
  saveToken: jest.fn(),
  removeToken: jest.fn(),
  validateRefreshToken: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mod = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: FileService, useValue: fileMock },
        { provide: EmailService, useValue: emailMock },
        { provide: TokenService, useValue: tokenMock },
      ],
    }).compile();

    service = mod.get(AuthService);
  });

  describe('register', () => {
    it('creates user and returns tokens', async () => {
      usersMock.findByEmail.mockResolvedValue(null);
      usersMock.createUser.mockResolvedValue({ ...userFixture });

      const res = await service.register(
        { email: 'u@mail.com', password: 'Password1!', name: 'User' } as any,
        {} as Express.Multer.File,
      );

      expect(usersMock.createUser).toHaveBeenCalled();
      expect(res).toEqual({
        accessToken: 'acc',
        refreshToken: 'ref',
        user: { ...userFixture, passwordHash: undefined },
      });
    });

    it('rejects duplicate email', async () => {
      usersMock.findByEmail.mockResolvedValue(userFixture);

      await expect(service.register({ email: 'u@mail.com', password: 'x', name: 'n' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      usersMock.findByEmail.mockResolvedValue({ ...userFixture, passwordHash: await bcrypt.hash('pass', 1) });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as any);

      const res = await service.login({ email: 'u@mail.com', password: 'pass' } as any);

      expect(res.accessToken).toBe('acc');
      expect(res.user.email).toBe('u@mail.com');
    });

    it('throws for bad credentials', async () => {
      usersMock.findByEmail.mockResolvedValue(null);

      await expect(service.login({ email: 'bad', password: 'x' } as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('issues new tokens', async () => {
      tokenMock.validateRefreshToken.mockReturnValue({ sub: 1 });
      usersMock.findById.mockResolvedValue(userFixture);

      const res = await service.refresh('oldRef');

      expect(tokenMock.validateRefreshToken).toHaveBeenCalledWith('oldRef');
      expect(res.accessToken).toBe('acc');
    });

    it('throws for invalid token', async () => {
      tokenMock.validateRefreshToken.mockReturnValue(null);

      await expect(service.refresh('broken')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('removes token', async () => {
      tokenMock.removeToken.mockResolvedValue(1);

      await service.logout('ref');
      expect(tokenMock.removeToken).toHaveBeenCalledWith('ref');
    });

    it('throws for unknown token', async () => {
      tokenMock.removeToken.mockResolvedValue(null);

      await expect(service.logout('bad')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('resetPassword', () => {
    it('throws on invalid or expired token', async () => {
      usersMock.findByResetToken.mockResolvedValue(null);

      await expect(service.resetPassword('t', { password: 'P1!' } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates password when token valid', async () => {
      usersMock.findByResetToken.mockResolvedValue({ ...userFixture, resetTokenExpires: Date.now() + 10000 });
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('newHash' as any);

      await service.resetPassword('tok', { password: 'New1!' } as any);
      expect(usersMock.updatePassword).toHaveBeenCalled();
    });
  });

  it('does nothing if email not found', async () => {
    usersMock.findByEmail.mockResolvedValue(null);

    await service.sendResetPasswordLink('none@mail.com');
    expect(emailMock.sendResetPasswordEmail).not.toHaveBeenCalled();
  });

  it('sends reset link when user exists', async () => {
    usersMock.findByEmail.mockResolvedValue(userFixture);
    jest.spyOn(crypto, 'randomBytes').mockImplementation(() => Buffer.from('token'));

    await service.sendResetPasswordLink('u@mail.com');
    expect(emailMock.sendResetPasswordEmail).toHaveBeenCalled();
  });
});
