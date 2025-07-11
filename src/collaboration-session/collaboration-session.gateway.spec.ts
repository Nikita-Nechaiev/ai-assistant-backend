/* ------------------------------------------------------------------ */
/*  collaboration-session.gateway.spec.ts                             */
/*  Полное покрытие всех веток CollaborationSessionGateway            */
/* ------------------------------------------------------------------ */
import { CollaborationSessionGateway } from './collaboration-session.gateway';
import { SessionPresenceService } from 'src/collaboration-session/presence/session-presence.service';
import { MessagesService } from 'src/messages/messages.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { CollaborationSessionService } from './collaboration-session.service';
import { AuthService } from 'src/auth/auth.service';
import { Permission } from 'src/common/enums/enums';
import { verify as jwtVerify } from 'jsonwebtoken';
import { Logger } from '@nestjs/common';

/* ------------------------------------------------------------------ */
/* Helpers: fake socket & server                                      */
/* ------------------------------------------------------------------ */
function fakeSocket(id = 'sock-1', userId = 7) {
  const s: any = {
    id,
    data: { userId },
    handshake: { headers: { cookie: '' } },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(), // chain-able .to().emit()
    disconnect: jest.fn(),
  };

  return s;
}
function fakeServer() {
  const svr: any = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    socketsLeave: jest.fn(),
  };

  return svr;
}

/* ------------------------------------------------------------------ */
/* Hard mocks for injected services                                   */
/* ------------------------------------------------------------------ */
const authMock = { refresh: jest.fn() };
const presenceMock = {
  leave: jest.fn(),
  join: jest.fn(),
  getSessionIdBySocket: jest.fn(),
  getSessionTotalData: jest.fn(),
  getSessionData: jest.fn(),
};
const msgMock = {
  createMessage: jest.fn(),
  getMessagesForSession: jest.fn(),
};
const userSessMock = {
  findByUserAndSession: jest.fn(),
  updatePermissions: jest.fn(),
};
const collabMock = {
  deleteSession: jest.fn(),
  updateSessionName: jest.fn(),
  findById: jest.fn(),
};

/* jsonwebtoken verify mock */
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const verifyMock = jwtVerify as unknown as jest.Mock;

/* ------------------------------------------------------------------ */
/* Factory to build gateway with our mocks                            */
/* ------------------------------------------------------------------ */
function buildGateway() {
  const gw = new CollaborationSessionGateway(
    authMock as unknown as AuthService,
    presenceMock as unknown as SessionPresenceService,
    msgMock as unknown as MessagesService,
    userSessMock as unknown as UserCollaborationSessionService,
    collabMock as unknown as CollaborationSessionService,
  );

  gw['server'] = fakeServer(); // inject fake Server

  return gw;
}

/* silence Logger output during tests */
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */
describe('CollaborationSessionGateway – branches & side-effects', () => {
  beforeEach(() => jest.clearAllMocks());

  /* ---------- afterInit(): log branch ---------- */
  it('afterInit logs initialisation', () => {
    const gw = buildGateway();
    const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    gw.afterInit();

    expect(spy).toHaveBeenCalledWith('WebSocket gateway initialised');
  });

  /* ---------- handleDisconnect(): userLeft broadcast ---------- */
  it('handleDisconnect emits userLeft when presence returns id', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.leave.mockResolvedValue(33);

    await gw.handleDisconnect(socket as any);

    expect(presenceMock.leave).toHaveBeenCalledWith(socket.id, 7);
    expect(gw['server'].to).toHaveBeenCalledWith('session_33');
    expect(gw['server'].emit).toHaveBeenCalledWith('userLeft', { userId: 7 });
  });

  /* ---------- joinSession(): happy path ---------- */
  it('joinSession joins room, emits snapshot and broadcasts new user', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.join.mockResolvedValue({
      isAllowed: true,
      snapshot: { ok: 1 },
      isFirstJoin: true,
      newUser: { id: 99 },
    });

    await gw.joinSession(123, socket as any);

    expect(socket.join).toHaveBeenCalledWith('session_123');
    expect(socket.emit).toHaveBeenCalledWith('totalSessionData', { ok: 1 });
    expect(socket.to).toHaveBeenCalledWith('session_123');
    expect(socket.to().emit).toHaveBeenCalledWith('newOnlineUser', { id: 99 });
  });

  /* ---------- joinSession(): forbidden branch ---------- */
  it('joinSession sends invalidSession and exits when not allowed', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.join.mockResolvedValue({
      isAllowed: false,
      snapshot: null,
      isFirstJoin: false,
      newUser: null,
    });

    await gw.joinSession(321, socket as any);

    expect(socket.emit).toHaveBeenCalledWith('invalidSession', {
      message: 'You do not have permission to access this page',
    });
    expect(socket.join).not.toHaveBeenCalled();
  });

  /* ---------- getTotalSessionData(): early-return branch ---------- */
  it('getTotalSessionData returns early when no session id', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.getSessionIdBySocket.mockReturnValue(undefined);

    await gw.getTotalSessionData(undefined, socket as any);

    expect(presenceMock.getSessionTotalData).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  /* ---------- deleteSession(): complete flow ---------- */
  it('deleteSession removes session, notifies users and kicks sockets', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.leave.mockResolvedValue(undefined);

    await gw.deleteSession(socket as any, 101);

    expect(collabMock.deleteSession).toHaveBeenCalledWith(101);
    expect(presenceMock.leave).toHaveBeenCalledWith(socket.id, 7);
    expect(gw['server'].to).toHaveBeenCalledWith('session_101');
    expect(gw['server'].emit).toHaveBeenCalledWith('sessionDeleted', {
      sessionId: 101,
      message: 'This session has been deleted by the admin',
      userId: 7,
    });
    expect(gw['server'].socketsLeave).toHaveBeenCalledWith('session_101');
  });

  /* ---------- renameSession(): full update ---------- */
  it('renameSession updates name, fetches fresh data and broadcasts', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.getSessionIdBySocket.mockReturnValue(202);
    presenceMock.getSessionData.mockResolvedValue({ id: 202, n: 'new' });

    await gw.renameSession('Brand-new title', socket as any);

    expect(collabMock.updateSessionName).toHaveBeenCalledWith(202, 'Brand-new title');
    expect(presenceMock.getSessionData).toHaveBeenCalledWith(202);
    expect(gw['server'].to).toHaveBeenCalledWith('session_202');
    expect(gw['server'].emit).toHaveBeenCalledWith('sessionData', { id: 202, n: 'new' });
  });

  /* ---------- changePermissions(): early-return branch ---------- */
  it('changePermissions exits early when socket not in a session', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.getSessionIdBySocket.mockReturnValue(undefined);

    await gw.changePermissions(socket as any, { userId: 11, permission: Permission.ADMIN });

    expect(userSessMock.updatePermissions).not.toHaveBeenCalled();
    expect(gw['server'].to).not.toHaveBeenCalled();
  });

  /* ---------- existing tests kept for full coverage ---------- */
  it('sendMessage broadcasts newMessage to room', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.getSessionIdBySocket.mockReturnValue(41);
    msgMock.createMessage.mockResolvedValue({ id: 1, text: 'hi' });

    await gw.sendMessage('hi', socket as any);

    expect(msgMock.createMessage).toHaveBeenCalledWith({ id: 7 }, 41, 'hi');
    expect(gw['server'].to).toHaveBeenCalledWith('session_41');
    expect(gw['server'].emit).toHaveBeenCalledWith('newMessage', { id: 1, text: 'hi' });
  });

  it('getMessages emits messages to client', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.getSessionIdBySocket.mockReturnValue(42);
    collabMock.findById.mockResolvedValue({ id: 42 });
    msgMock.getMessagesForSession.mockResolvedValue([{ id: 2 }]);

    await gw.getMessages(socket as any);

    expect(msgMock.getMessagesForSession).toHaveBeenCalledWith({ id: 42 });
    expect(socket.emit).toHaveBeenCalledWith('messages', [{ id: 2 }]);
  });

  it('leaveSession removes socket from room & notifies others', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.leave.mockResolvedValue(55);

    await gw.leaveSession(socket as any);

    expect(socket.leave).toHaveBeenCalledWith('session_55');
    expect(socket.to).toHaveBeenCalledWith('session_55');
    expect(socket.to().emit).toHaveBeenCalledWith('userLeft', { userId: 7 });
  });

  it('changePermissions updates through service & broadcasts', async () => {
    const gw = buildGateway();
    const socket = fakeSocket();

    presenceMock.getSessionIdBySocket.mockReturnValue(60);
    userSessMock.findByUserAndSession.mockResolvedValue({ id: 13 });

    await gw.changePermissions(socket as any, { userId: 8, permission: Permission.EDIT });

    expect(userSessMock.updatePermissions).toHaveBeenCalledWith(13, [Permission.READ, Permission.EDIT]);
    expect(gw['server'].to).toHaveBeenCalledWith('session_60');
    expect(gw['server'].emit).toHaveBeenCalledWith('permissionsChanged', {
      userId: 8,
      permissions: [Permission.READ, Permission.EDIT],
    });
  });
});

/* ------------------------------------------------------------------ */
/* Connection-handling scenarios                                      */
/* ------------------------------------------------------------------ */
describe('CollabGateway handleConnection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('joins dashboard room when tokens valid', async () => {
    const gw = buildGateway();
    const sock = fakeSocket('sock-ok', 7);

    sock.handshake.headers.cookie = 'accessToken=good; refreshToken=ref';
    verifyMock.mockReturnValueOnce({ sub: 7 });

    await gw.handleConnection(sock as any);

    expect(sock.join).toHaveBeenCalledWith('dashboard_7');
    expect(sock.disconnect).not.toHaveBeenCalled();
  });

  it('refreshes tokens on expiry and still joins', async () => {
    const gw = buildGateway();
    const sock = fakeSocket('sock-exp', 7);

    sock.handshake.headers.cookie = 'accessToken=old; refreshToken=refresh-x';

    const tokenErr: any = new Error('expired');

    tokenErr.name = 'TokenExpiredError';

    verifyMock
      .mockImplementationOnce(() => {
        throw tokenErr;
      })
      .mockReturnValueOnce({ sub: 7 });

    authMock.refresh.mockResolvedValue({
      accessToken: 'newAcc',
      refreshToken: 'newRef',
    });

    await gw.handleConnection(sock as any);

    expect(authMock.refresh).toHaveBeenCalledWith('refresh-x');
    expect(sock.handshake.headers.cookie).toContain('accessToken=newAcc');
    expect(sock.join).toHaveBeenCalledWith('dashboard_7');
  });

  it('disconnects socket when cookies missing', async () => {
    const gw = buildGateway();
    const sock = fakeSocket('sock-bad', 7); // cookie пустая

    await gw.handleConnection(sock as any);

    expect(sock.disconnect).toHaveBeenCalled();
    expect(sock.join).not.toHaveBeenCalled();
  });

  it('disconnects socket when verify throws непредвиденную ошибку', async () => {
    const gw = buildGateway();
    const sock = fakeSocket('sock-fail', 7);

    sock.handshake.headers.cookie = 'accessToken=b0rk; refreshToken=r';
    verifyMock.mockImplementationOnce(() => {
      throw new Error('bad-signature');
    });

    await gw.handleConnection(sock as any);

    expect(sock.disconnect).toHaveBeenCalled();
    expect(sock.join).not.toHaveBeenCalled();
  });
});
