import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvitationService } from './invitation.service';
import { Invitation } from './invitation.model';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { InvitationStatus, NotificationStatus, Permission } from 'src/common/enums/enums';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const repoFactory = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  delete: jest.fn(),
});

const ucsMock = {
  createSession: jest.fn(),
};

describe('InvitationService', () => {
  let svc: InvitationService;
  let repo: jest.Mocked<Repository<Invitation>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mod = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: getRepositoryToken(Invitation), useFactory: repoFactory },
        { provide: UserCollaborationSessionService, useValue: ucsMock },
      ],
    }).compile();

    svc = mod.get(InvitationService);
    repo = mod.get(getRepositoryToken(Invitation));
  });

  function fullInvitation(partial: Partial<Invitation> = {}): Invitation {
    return {
      id: partial.id ?? 1,
      date: partial.date ?? new Date(),
      role: partial.role ?? Permission.READ,
      invitationStatus: partial.invitationStatus ?? InvitationStatus.PENDING,
      notificationStatus: partial.notificationStatus ?? NotificationStatus.UNREAD,
      receiver: partial.receiver ?? ({ id: 2 } as any),
      session: partial.session ?? ({ id: 3 } as any),
    } as Invitation;
  }

  it('creates invitation', async () => {
    repo.create.mockReturnValue({} as any);
    repo.save.mockResolvedValue(fullInvitation({ id: 10 }));

    const dto = { session: { id: 3 }, receiver: { id: 2 } } as any;
    const res = await svc.create(dto);

    expect(repo.create).toHaveBeenCalledWith(dto);
    expect(res.id).toBe(10);
  });

  it('updates invitation when exists', async () => {
    repo.findOne.mockResolvedValueOnce(fullInvitation({ id: 5 }));
    repo.save.mockResolvedValue(fullInvitation({ id: 5, role: Permission.EDIT }));
    repo.findOne.mockResolvedValueOnce(fullInvitation({ id: 5, role: Permission.EDIT }));

    const res = await svc.update(5, { role: Permission.EDIT } as any);

    expect(res.role).toBe(Permission.EDIT);
  });

  it('throws on updating missing invitation', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.update(99, {} as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes invitation or throws', async () => {
    repo.delete.mockResolvedValue({ affected: 1 } as any);
    await expect(svc.delete(4)).resolves.toBeUndefined();

    repo.delete.mockResolvedValue({ affected: 0 } as any);
    await expect(svc.delete(4)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findById returns invitation or throws', async () => {
    repo.findOne.mockResolvedValue(fullInvitation({ id: 7 }));
    expect(await svc.findById(7)).toBeDefined();

    repo.findOne.mockResolvedValue(null);
    await expect(svc.findById(8)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findByReceiverId delegates to repo.find', async () => {
    repo.find.mockResolvedValue([]);
    await svc.findByReceiverId(2);
    expect(repo.find).toHaveBeenCalledWith({
      where: { receiver: { id: 2 } },
      relations: ['session', 'receiver'],
      order: { date: 'DESC' },
    });
  });

  it('getInvitationsForSession delegates to repo.find', async () => {
    repo.find.mockResolvedValue([]);
    await svc.getInvitationsForSession(3);
    expect(repo.find).toHaveBeenCalledWith({
      where: { session: { id: 3 } },
      relations: ['receiver'],
      order: { date: 'DESC' },
    });
  });

  it('accepts pending invitation and creates user session', async () => {
    const inv = fullInvitation();

    repo.findOne.mockResolvedValue(inv);
    repo.save.mockResolvedValue({ ...inv, invitationStatus: InvitationStatus.ACCEPTED });
    ucsMock.createSession.mockResolvedValue({});

    const res = await svc.acceptInvitation(1);

    expect(res.invitationStatus).toBe(InvitationStatus.ACCEPTED);
    expect(ucsMock.createSession).toHaveBeenCalledWith(inv.receiver.id, inv.session.id, [Permission.READ]);
  });

  it('rejects accept when status not pending', async () => {
    repo.findOne.mockResolvedValue(fullInvitation({ invitationStatus: InvitationStatus.ACCEPTED }));

    await expect(svc.acceptInvitation(2)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('changes role to EDIT', async () => {
    const inv = fullInvitation({ role: Permission.READ, id: 12 });

    repo.findOne.mockResolvedValue(inv);
    repo.save.mockResolvedValue({ ...inv, role: Permission.EDIT });

    const res = await svc.changeInvitationRole(12, Permission.EDIT);

    expect(res.role).toBe(Permission.EDIT);
  });

  it('throws when new role invalid', async () => {
    await expect(svc.changeInvitationRole(1, Permission.ADMIN)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when invitation not found on role change', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.changeInvitationRole(99, Permission.READ)).rejects.toBeInstanceOf(NotFoundException);
  });
});
