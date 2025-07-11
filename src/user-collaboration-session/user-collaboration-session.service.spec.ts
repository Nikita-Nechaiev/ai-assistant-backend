import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCollaborationSessionService } from './user-collaboration-session.service';
import { UserCollaborationSession } from './user-collaboration-session.model';
import { UsersService } from 'src/user/users.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Permission } from 'src/common/enums/enums';

const repoFactory = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

const usersMock = {
  findById: jest.fn(),
};

describe('UserCollaborationSessionService', () => {
  let svc: UserCollaborationSessionService;
  let repo: jest.Mocked<Repository<UserCollaborationSession>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mod = await Test.createTestingModule({
      providers: [
        UserCollaborationSessionService,
        { provide: getRepositoryToken(UserCollaborationSession), useFactory: repoFactory },
        { provide: UsersService, useValue: usersMock },
      ],
    }).compile();

    svc = mod.get(UserCollaborationSessionService);
    repo = mod.get(getRepositoryToken(UserCollaborationSession));
  });

  it('returns paginated sessions ordered by id ASC', async () => {
    repo.find.mockResolvedValue([{ id: 1 }] as any);

    const res = await svc.getUserCollaborationSessions(5, 10, 25);

    expect(repo.find).toHaveBeenCalledWith({
      where: { user: { id: 5 } },
      relations: ['session'],
      skip: 10,
      take: 25,
      order: { id: 'ASC' },
    });
    expect(res).toEqual([{ id: 1 }]);
  });

  it('creates session row for user', async () => {
    usersMock.findById.mockResolvedValue({ id: 5 } as any);
    repo.create.mockReturnValue({} as any);
    repo.save.mockResolvedValue({ id: 2 } as any);

    const res = await svc.createSession(5, 9, [Permission.READ, Permission.EDIT]);

    expect(repo.create).toHaveBeenCalledWith({
      user: { id: 5 },
      session: { id: 9 },
      permissions: [Permission.READ, Permission.EDIT],
    });
    expect(res).toEqual({ id: 2 });
  });

  it('throws BadRequest when sessionId is 0', async () => {
    await expect(svc.createSession(1, 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds timeSpent to existing row', async () => {
    const existing = { id: 1, timeSpent: 10 } as UserCollaborationSession;

    repo.findOne.mockResolvedValue(existing);
    repo.save.mockResolvedValue({ ...existing, timeSpent: 17 } as any);

    const res = await svc.updateTimeSpent(3, 4, 7);

    expect(res.timeSpent).toBe(17);
    expect(repo.save).toHaveBeenCalledWith({ ...existing, timeSpent: 17 });
  });

  it('updateTimeSpent throws NotFound when row missing', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(svc.updateTimeSpent(3, 4, 5)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates lastInteracted date', async () => {
    const existing = { id: 2 } as UserCollaborationSession;

    repo.findOne.mockResolvedValue(existing);

    const date = new Date('2025-07-05');

    repo.save.mockResolvedValue({ ...existing, lastInteracted: date } as any);

    const res = await svc.updateLastInteracted(1, 2, date);

    expect(repo.save).toHaveBeenCalledWith({ ...existing, lastInteracted: date });
    expect(res.lastInteracted).toBe(date);
  });

  it('updateLastInteracted throws NotFound when row missing', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(svc.updateLastInteracted(1, 2, new Date())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets new permissions list', async () => {
    const sess = { id: 3, permissions: [Permission.READ] } as UserCollaborationSession;

    repo.findOne.mockResolvedValue(sess);
    repo.save.mockResolvedValue({ ...sess, permissions: [Permission.EDIT] } as any);

    const res = await svc.updatePermissions(3, [Permission.EDIT]);

    expect(res.permissions).toEqual([Permission.EDIT]);
  });

  it('throws NotFound on updatePermissions if row missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.updatePermissions(8, [])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes collaboration session row', async () => {
    repo.findOne.mockResolvedValue({ id: 4 } as any);

    await svc.deleteSession(4);
    expect(repo.remove).toHaveBeenCalledWith({ id: 4 });
  });

  it('deleteSession throws NotFound when absent', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.deleteSession(100)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('looks up by userId + sessionId with relations', async () => {
    repo.findOne.mockResolvedValue({ id: 5 } as any);

    await svc.findByUserAndSession(7, 9);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { user: { id: 7 }, session: { id: 9 } },
      relations: ['user'],
    });
  });
});
