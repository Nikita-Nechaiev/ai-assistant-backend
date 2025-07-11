import { Test } from '@nestjs/testing';
import { CreateInvitationUseCase } from './create-invitation.usecase';
import { UsersService } from 'src/user/users.service';
import { CollaborationSessionService } from 'src/collaboration-session/collaboration-session.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { InvitationService } from 'src/invitation/invitation.service';
import { InvitationStatus, NotificationStatus, Permission } from 'src/common/enums/enums';

/* ------------------------------------------------------------------ */
/* mocks                                                              */
const usersMock = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
};
const collabMock = { findById: jest.fn() };
const ucsMock = { findByUserAndSession: jest.fn() };
const inviteMock = {
  findByReceiverAndSession: jest.fn(),
  create: jest.fn(),
};

describe('CreateInvitationUseCase', () => {
  let uc: CreateInvitationUseCase;
  const params = {
    sessionId: 1,
    inviterId: 10,
    receiverEmail: 'b@mail',
    role: Permission.READ,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mod = await Test.createTestingModule({
      providers: [
        CreateInvitationUseCase,
        { provide: UsersService, useValue: usersMock },
        { provide: CollaborationSessionService, useValue: collabMock },
        { provide: UserCollaborationSessionService, useValue: ucsMock },
        { provide: InvitationService, useValue: inviteMock },
      ],
    }).compile();

    uc = mod.get(CreateInvitationUseCase);

    collabMock.findById.mockResolvedValue({ id: 1 });
    usersMock.findByEmail.mockResolvedValue({ id: 2, email: 'b@mail' });
    usersMock.findById.mockResolvedValue({ id: 10, email: 'a@mail' });
    ucsMock.findByUserAndSession.mockResolvedValue(null);
    inviteMock.findByReceiverAndSession.mockResolvedValue(null);
    inviteMock.create.mockResolvedValue({ id: 99 });
  });

  it('creates invitation when all pre-conditions satisfied', async () => {
    const res = await uc.execute(params);

    expect(inviteMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: Permission.READ,
        receiver: { id: 2, email: 'b@mail' },
        session: { id: 1 },
        inviterEmail: 'a@mail',
        invitationStatus: InvitationStatus.PENDING,
        notificationStatus: NotificationStatus.UNREAD,
      }),
    );
    expect(res).toEqual({ id: 99 });
  });

  it('throws when session not found', async () => {
    collabMock.findById.mockResolvedValue(null);
    await expect(uc.execute(params)).rejects.toThrow('CollaborationSession');
  });

  it('throws when receiver not found', async () => {
    usersMock.findByEmail.mockResolvedValue(null);
    await expect(uc.execute(params)).rejects.toThrow('User with email');
  });

  it('throws when inviter not found', async () => {
    usersMock.findById.mockResolvedValue(null);
    await expect(uc.execute(params)).rejects.toThrow('Inviter not found');
  });

  it('throws when receiver already participant', async () => {
    ucsMock.findByUserAndSession.mockResolvedValue({});
    await expect(uc.execute(params)).rejects.toThrow('already a participant');
  });

  it('throws when existing invitation present', async () => {
    inviteMock.findByReceiverAndSession.mockResolvedValue({});
    await expect(uc.execute(params)).rejects.toThrow('already has an invitation');
  });
});
