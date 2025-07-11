import { InvitationGateway } from './invitation.gateway';
import { InvitationService } from './invitation.service';
import { CreateInvitationUseCase } from './use-cases/create-invitation.usecase';
import { SessionContextService } from 'src/common/utils/session-context.service';
import { NotificationStatus, Permission } from 'src/common/enums/enums';

const sock = (uid?: number) =>
  ({
    data: uid ? { userId: uid } : {},
    join: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  }) as any;

const svr = () =>
  ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }) as any;

const inv = {
  findByReceiverId: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  delete: jest.fn(),
  acceptInvitation: jest.fn(),
  getInvitationsForSession: jest.fn(),
  changeInvitationRole: jest.fn(),
};

const create = { execute: jest.fn() };
const ctx = { getSessionIdOrThrow: jest.fn() };
const dash = (id: number) => `dashboard_${id}`;
const ses = (id: number) => `session_${id}`;

const build = () => {
  const g = new InvitationGateway(inv as any, create as any, ctx as any);

  g['server'] = svr();

  return g;
};

describe('InvitationGateway', () => {
  beforeEach(() => jest.clearAllMocks());

  it('joinDashboard happy path', async () => {
    const g = build();
    const s = sock(1);

    inv.findByReceiverId.mockResolvedValue(['n']);
    await g.joinDashboard(s);
    expect(s.join).toHaveBeenCalledWith(dash(1));
    expect(s.emit).toHaveBeenCalledWith('notifications', ['n']);
  });

  it('joinDashboard no user → error', async () => {
    const g = build();
    const s = sock(undefined);

    await g.joinDashboard(s);
    expect(s.emit).toHaveBeenCalledWith('error', 'User not identified');
  });

  it('updateNotificationStatus happy path', async () => {
    const g = build();
    const s = sock(5);

    inv.update.mockResolvedValue({
      id: 2,
      session: { id: 10 },
      receiver: { id: 5 },
    });
    await g.updateNotificationStatus(s, {
      invitationId: 2,
      status: NotificationStatus.READ,
    });
    expect(inv.update).toHaveBeenCalled();
    expect(g['server'].to).toHaveBeenCalledWith(ses(10));
    expect(g['server'].emit).toHaveBeenCalledWith('invitationUpdated', expect.any(Object));
  });

  it('updateNotificationStatus no uid', async () => {
    const g = build();
    const s = sock();

    await g.updateNotificationStatus(s, {
      invitationId: 9,
      status: NotificationStatus.UNREAD,
    });
    expect(inv.update).not.toHaveBeenCalled();
    expect(s.emit).toHaveBeenCalledWith('error', 'User not identified');
  });

  it('updateNotificationStatus service error', async () => {
    const g = build();
    const s = sock(6);

    inv.update.mockRejectedValue(new Error('boom'));
    await g.updateNotificationStatus(s, { invitationId: 3, status: NotificationStatus.READ });
    expect(s.emit).toHaveBeenCalledWith('error', 'boom');
  });

  it('deleteNotification happy path', async () => {
    const g = build();
    const s = sock(3);

    inv.findById.mockResolvedValue({
      id: 4,
      session: { id: 20 },
      receiver: { id: 3 },
    });
    await g.deleteNotification(s, { invitationId: 4 });
    expect(inv.delete).toHaveBeenCalledWith(4);
    expect(g['server'].emit).toHaveBeenCalledWith('notificationDeleted', { invitationId: 4 });
  });

  it('deleteNotification not found', async () => {
    const g = build();
    const s = sock(9);

    inv.findById.mockResolvedValue(null);
    await g.deleteNotification(s, { invitationId: 7 });
    expect(s.emit).toHaveBeenCalledWith('error', 'Invitation not found');
  });

  it('acceptInvitation success', async () => {
    const g = build();
    const s = sock(11);

    inv.acceptInvitation.mockResolvedValue({
      id: 8,
      session: { id: 33 },
    });
    await g.acceptInvitation(s, { invitationId: 8 });
    expect(s.emit).toHaveBeenCalledWith('invitationAccepted', {
      invitationId: 8,
      invitationSessionId: 33,
    });
    expect(inv.delete).toHaveBeenCalledWith(8);
  });

  it('acceptInvitation no user', async () => {
    const g = build();
    const s = sock();

    await g.acceptInvitation(s, { invitationId: 1 });
    expect(s.emit).toHaveBeenCalledWith('error', 'User not identified');
  });

  it('createInvitation success', async () => {
    const g = build();
    const s = sock(14);

    ctx.getSessionIdOrThrow.mockReturnValue(40);
    create.execute.mockResolvedValue({
      receiver: { id: 99 },
      session: { id: 40 },
    });
    await g.createInvitation(s, { email: 'a@mail', role: Permission.READ });
    expect(create.execute).toHaveBeenCalled();
    expect(g['server'].to).toHaveBeenCalledWith(dash(99));
    expect(g['server'].to).toHaveBeenCalledWith(ses(40));
  });

  it('createInvitation error', async () => {
    const g = build();
    const s = sock(15);

    ctx.getSessionIdOrThrow.mockReturnValue(41);
    create.execute.mockRejectedValue(new Error('fail'));
    await g.createInvitation(s, { email: 'b@mail', role: Permission.READ });
    expect(s.emit).toHaveBeenCalledWith('error', 'fail');
  });

  it('getInvitations success', async () => {
    const g = build();
    const s = sock(1);

    ctx.getSessionIdOrThrow.mockReturnValue(55);
    inv.getInvitationsForSession.mockResolvedValue(['inv']);
    await g.getInvitations(s);
    expect(s.emit).toHaveBeenCalledWith('invitations', ['inv']);
  });

  it('getInvitations error', async () => {
    const g = build();
    const s = sock(1);

    ctx.getSessionIdOrThrow.mockReturnValue(55);
    inv.getInvitationsForSession.mockRejectedValue(new Error('x'));
    await g.getInvitations(s);
    expect(s.emit).toHaveBeenCalledWith('error', 'x');
  });

  it('changeInvitationRole success', async () => {
    const g = build();
    const s = sock(22);

    inv.changeInvitationRole.mockResolvedValue({
      session: { id: 70 },
      receiver: { id: 22 },
    });
    await g.changeInvitationRole(s, { invitationId: 5, newRole: Permission.EDIT });
    expect(g['server'].to).toHaveBeenCalledWith(ses(70));
    expect(g['server'].emit).toHaveBeenCalledWith('invitationUpdated', expect.any(Object));
  });

  it('changeInvitationRole error', async () => {
    const g = build();
    const s = sock(22);

    inv.changeInvitationRole.mockRejectedValue(new Error('err'));
    await g.changeInvitationRole(s, { invitationId: 9, newRole: Permission.READ });
    expect(s.emit).toHaveBeenCalledWith('error', 'err');
  });
});
