import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaborationSessionService } from './collaboration-session.service';
import { CollaborationSession } from './collaboration-session.model';
import { UsersService } from 'src/user/users.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { Permission } from 'src/common/enums/enums';

const repoFactory = () => ({
  createQueryBuilder: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
});

const usersMock = { findById: jest.fn() };
const ucsMock = {
  getUserCollaborationSessions: jest.fn(),
  createSession: jest.fn(),
};

describe('CollaborationSessionService', () => {
  let svc: CollaborationSessionService;
  let repo: jest.Mocked<Repository<CollaborationSession>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mod = await Test.createTestingModule({
      providers: [
        CollaborationSessionService,
        { provide: getRepositoryToken(CollaborationSession), useFactory: repoFactory },
        { provide: UsersService, useValue: usersMock },
        { provide: UserCollaborationSessionService, useValue: ucsMock },
      ],
    }).compile();

    svc = mod.get(CollaborationSessionService);
    repo = mod.get(getRepositoryToken(CollaborationSession));
  });

  describe('getUserSessions', () => {
    it('returns empty array when user has no sessions', async () => {
      ucsMock.getUserCollaborationSessions.mockResolvedValue([]);

      const res = await svc.getUserSessions(1, 0, 25);

      expect(res).toEqual([]);
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('builds query with pagination and search', async () => {
      ucsMock.getUserCollaborationSessions.mockResolvedValue([{ session: { id: 5 } }, { session: { id: 6 } }] as any);

      const qb = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 5,
            name: 'Doc',
            createdAt: new Date(),
            userCollaborationSessions: [
              {
                lastInteracted: new Date('2024-01-01'),
                user: { id: 1, name: 'A', email: 'a@mail', avatar: 'x' },
              },
            ],
          },
        ]),
      };

      repo.createQueryBuilder.mockReturnValue(qb as any);

      const res = await svc.getUserSessions(9, 25, 25, 'doc');

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('session');
      expect(qb.where).toHaveBeenCalledWith('session.id IN (:...sessionIds)', { sessionIds: [5, 6] });
      expect(qb.skip).toHaveBeenCalledWith(25);
      expect(qb.andWhere).toHaveBeenCalledWith('LOWER(session.name) ILIKE :search', { search: '%doc%' });
      expect(res[0]).toHaveProperty('id', 5);
      expect(res[0].collaborators[0].email).toBe('a@mail');
    });
  });

  describe('createSession', () => {
    it('creates session and links creator with ADMIN permissions', async () => {
      usersMock.findById.mockResolvedValue({ id: 3 });
      repo.create.mockReturnValue({ name: 'New' } as any);
      repo.save.mockResolvedValue({ id: 8, name: 'New' } as CollaborationSession);

      const res = await svc.createSession(3, 'New');

      expect(repo.create).toHaveBeenCalledWith({ name: 'New' });
      expect(ucsMock.createSession).toHaveBeenCalledWith(3, 8, [Permission.EDIT, Permission.READ, Permission.ADMIN]);
      expect(res.id).toBe(8);
    });

    it('throws when user not found', async () => {
      usersMock.findById.mockResolvedValue(null);

      await expect(svc.createSession(99, 'X')).rejects.toThrow('User not found');
    });
  });

  it('returns session or throws', async () => {
    repo.findOne.mockResolvedValue({ id: 1 } as CollaborationSession);
    expect(await svc.getSession(1)).toEqual({ id: 1 });

    repo.findOne.mockResolvedValue(null);
    await expect(svc.getSession(2)).rejects.toThrow('Session not found');
  });

  it('updates name when session exists', async () => {
    repo.findOne.mockResolvedValue({ id: 5, name: 'Old' } as CollaborationSession);
    repo.save.mockImplementation((v) =>
      Promise.resolve({
        ...v,
        id: v.id ?? 1,
        name: v.name ?? 'Default session name',
        documents: [],
        userCollaborationSessions: [],
        invitations: [],
        messages: [],
        createdAt: new Date(),
      } as CollaborationSession),
    );

    const sess = await svc.updateSessionName(5, 'New');

    expect(sess.name).toBe('New');
    expect(repo.save).toHaveBeenCalledWith({ id: 5, name: 'New' });
  });

  it('throws when session absent on rename', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.updateSessionName(7, 'X')).rejects.toThrow('Session not found');
  });

  it('findById returns session or null on error', async () => {
    repo.findOne.mockResolvedValue({ id: 3 } as any);
    expect(await svc.findById(3)).toEqual({ id: 3 });

    repo.findOne.mockRejectedValue(new Error('db down'));
    expect(await svc.findById(4)).toBeNull();
  });

  it('deletes session when exists', async () => {
    repo.findOne.mockResolvedValue({ id: 2 } as any);
    repo.delete.mockResolvedValue({ affected: 1 } as any);

    await svc.deleteSession(2);
    expect(repo.delete).toHaveBeenCalledWith(2);
  });

  it('throws when trying to delete missing session', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.deleteSession(44)).rejects.toThrow('Session with ID 44 not found');
  });
});
