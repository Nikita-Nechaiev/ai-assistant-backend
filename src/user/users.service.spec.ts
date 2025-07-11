import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.model';
import { FileService } from 'src/file/file.service';
import * as bcrypt from 'bcrypt';
import { NotFoundException } from '@nestjs/common';
import { Role } from 'src/common/enums/enums';

const repoFactory = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const fileMock = { saveAvatarFile: jest.fn() };

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mod = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useFactory: repoFactory },
        { provide: FileService, useValue: fileMock },
      ],
    }).compile();

    service = mod.get(UsersService);
    repo = mod.get(getRepositoryToken(User));
  });

  it('findById returns user or throws', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 1 } as User);
    expect(await service.findById(1)).toEqual({ id: 1 });

    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.findById(2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns existing google user', async () => {
    const user = { id: 3 } as User;

    repo.findOne.mockResolvedValueOnce(user);

    const res = await service.findOrCreateGoogleUser('gid', 'a@mail', 'A', null);

    expect(res).toBe(user);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('creates new google user when absent', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    repo.create.mockReturnValue({ id: 4 } as any);
    repo.save.mockResolvedValue({ id: 4 } as User);

    const res = await service.findOrCreateGoogleUser('gid2', 'b@mail', 'B', 'pic');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'b@mail',
        oauthProvider: 'google',
        oauthId: 'gid2',
      }),
    );
    expect(res).toHaveProperty('id', 4);
  });

  it('creates and saves user with defaults', async () => {
    repo.create.mockReturnValue({ name: 'X' } as any);
    repo.save.mockResolvedValue({ id: 6 } as User);

    const res = await service.createUser({ name: 'X', email: 'x@mail' });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: [Role.USER],
      }),
    );
    expect(res).toEqual({ id: 6 });
  });

  it('returns all users ordered by createdAt DESC', async () => {
    repo.find.mockResolvedValue([]);

    await service.getAllUsers();
    expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
  });

  it('updates reset token and finds by comparing hashes', async () => {
    repo.update.mockResolvedValue(undefined);
    await service.updateResetToken(1, 'hash', 123);
    expect(repo.update).toHaveBeenCalledWith(1, { resetToken: 'hash', resetTokenExpires: 123 });

    repo.find.mockResolvedValue([
      { id: 1, resetToken: 'h1' },
      { id: 2, resetToken: 'h2' },
    ] as any);

    jest.spyOn(bcrypt, 'compare').mockImplementation(async (t, h) => h === 'h2');

    const found = await service.findByResetToken('token');

    expect(found?.id).toBe(2);
  });

  it('updates password hash and resets token fields', async () => {
    await service.updatePassword(5, 'newHash');
    expect(repo.update).toHaveBeenCalledWith(5, {
      passwordHash: 'newHash',
      resetToken: '',
      resetTokenExpires: null,
    });
  });

  it('updates profile, saves avatar when provided', async () => {
    const original = { id: 7, name: 'Old', avatar: 'old.png' } as User;

    repo.findOne.mockResolvedValue(original);
    fileMock.saveAvatarFile.mockResolvedValue('new.png');
    repo.update.mockResolvedValue(undefined);
    repo.findOne.mockResolvedValue({ ...original, name: 'New', avatar: 'new.png' } as User);

    const res = await service.updateProfile(7, { name: 'New' }, {} as Express.Multer.File);

    expect(fileMock.saveAvatarFile).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(7, { name: 'New', avatar: 'new.png' });
    expect(res.name).toBe('New');
  });
});
