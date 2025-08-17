import { Test } from '@nestjs/testing';
import { SessionPresenceService } from './session-presence.service';
import { SessionStateService } from 'src/common/state/session-state.service';
import { CollaborationSessionService } from 'src/collaboration-session/collaboration-session.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { Socket } from 'socket.io';
import { Permission } from 'src/common/enums/enums';

function fakeSocket(id: string, userId: number): Socket {
  return { id, data: { userId } } as unknown as Socket;
}

const state = new SessionStateService();
const collabMock = {
  getSession: jest.fn(),
};
const ucsMock = {
  findByUserAndSession: jest.fn(),
  updateTimeSpent: jest.fn(),
  updateLastInteracted: jest.fn(),
};

describe('SessionPresenceService', () => {
  let svc: SessionPresenceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    state.onlineUsers.clear();
    state.socketSessionMap.clear();

    const mod = await Test.createTestingModule({
      providers: [
        SessionPresenceService,
        { provide: SessionStateService, useValue: state },
        { provide: CollaborationSessionService, useValue: collabMock },
        { provide: UserCollaborationSessionService, useValue: ucsMock },
      ],
    }).compile();

    svc = mod.get(SessionPresenceService);
  });

  it('gets session id from socket map', () => {
    state.socketSessionMap.set('sock1', 77);
    expect(svc.getSessionIdBySocket('sock1')).toBe(77);
  });

  describe('join()', () => {
    const sock = fakeSocket('s1', 5);

    it('denies join when userCollabSession not found', async () => {
      ucsMock.findByUserAndSession.mockResolvedValue(null);

      const res = await svc.join(sock, 10);

      expect(res).toEqual({ isAllowed: false });
    });

    it('allows first join and adds to state', async () => {
      ucsMock.findByUserAndSession.mockResolvedValue({
        user: { id: 5, name: 'A', email: 'a@mail', avatar: 'x' },
        permissions: [Permission.READ],
      });
      collabMock.getSession.mockResolvedValue({ userCollaborationSessions: [] });

      const res = await svc.join(sock, 20);

      expect(res.isAllowed).toBeTruthy();
      expect(res.isFirstJoin).toBeTruthy();
      expect(state.onlineUsers.has(5)).toBeTruthy();
      expect(state.socketSessionMap.get('s1')).toBe(20);
    });
  });

  it('cleans up state and updates timeSpent on last socket', async () => {
    const socket = fakeSocket('sock2', 7);
    const start = Date.now() - 5000;

    state.onlineUsers.set(7, { sessionId: 30, startTime: start, socketIds: new Set(['sock2']) });
    state.socketSessionMap.set('sock2', 30);
    ucsMock.findByUserAndSession.mockResolvedValue({});

    const returnedSessionId = await svc.leave('sock2', 7);

    expect(returnedSessionId).toBe(30);
    expect(state.onlineUsers.has(7)).toBeFalsy();
    expect(state.socketSessionMap.has('sock2')).toBeFalsy();
    expect(ucsMock.updateTimeSpent).toHaveBeenCalled();
    expect(ucsMock.updateLastInteracted).toHaveBeenCalled();
  });

  it('returns only users online in the same session', async () => {
    state.onlineUsers.set(9, { sessionId: 40, startTime: Date.now(), socketIds: new Set(['x']) });
    collabMock.getSession.mockResolvedValue({
      userCollaborationSessions: [
        { user: { id: 9, name: 'N' }, permissions: [Permission.READ] },
        { user: { id: 10, name: 'M' }, permissions: [Permission.READ] },
      ],
    });

    const list = await svc.getOnlineUsers(40);

    expect(list.length).toBe(1);
    expect(list[0].id).toBe(9);
  });

  it('computes time spent for first and subsequent connections', async () => {
    ucsMock.findByUserAndSession.mockResolvedValue({ timeSpent: 0 });

    const sockA = fakeSocket('a', 11);
    const first = await svc.getTimeUserSpent(50, sockA);

    expect(first).toBe(0);

    const t0 = Date.now();

    jest.spyOn(Date, 'now').mockReturnValue(t0 + 4000);

    const sockB = fakeSocket('b', 11);
    const total = await svc.getTimeUserSpent(50, sockB);

    expect(total).toBeCloseTo(4, 0);
  });
});
