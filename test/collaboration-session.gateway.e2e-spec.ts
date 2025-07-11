/* test/collaboration-session.gateway.e2e-spec.ts
 *
 * Integration tests for CollaborationSessionGateway
 * ───────────────────────────────────────────────── */

import { Test } from '@nestjs/testing';
import { INestApplication, Logger, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as cookieParser from 'cookie-parser';
import { Server } from 'http';
import { io as ioc } from 'socket.io-client';

import { CollaborationSessionGateway } from 'src/collaboration-session/collaboration-session.gateway';
import { AuthService } from 'src/auth/auth.service';
import { SessionPresenceService } from 'src/collaboration-session/presence/session-presence.service';
import { MessagesService } from 'src/messages/messages.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { CollaborationSessionService } from 'src/collaboration-session/collaboration-session.service';

/* ─────────────── lightweight stubs ─────────────── */

const presenceStub = {
  _online: new Map<string, { userId: number; sessionId: number }>(),

  async join(socket: any, sessionId: number) {
    this._online.set(socket.id, { userId: socket.data.userId, sessionId });

    return {
      isAllowed: true,
      snapshot: { usersOnline: [socket.data.userId] },
      isFirstJoin: true,
      newUser: { id: socket.data.userId },
    };
  },

  async leave(socketId: string) {
    const entry = this._online.get(socketId);

    this._online.delete(socketId);

    return entry?.sessionId;
  },

  getSessionIdBySocket(socketId: string) {
    return this._online.get(socketId)?.sessionId;
  },

  async getSessionTotalData(_: any, sessionId: number) {
    const usersOnline = [...this._online.values()].filter((u) => u.sessionId === sessionId).map((u) => u.userId);

    return { usersOnline };
  },

  async getSessionData() {
    return {};
  },
};

const authStub = {
  async refresh() {
    throw new UnauthorizedException('should not be called in tests');
  },
};

const messagesStub = {
  async createMessage(_: any, __: number, text: string) {
    return { id: 99, text };
  },
  async getMessagesForSession() {
    return [{ id: 1, text: 'hello' }];
  },
};

const userSessionStub = { findByUserAndSession: async () => ({ id: 1 }) };
const collabSessionStub = {
  deleteSession: async () => undefined,
  findById: async () => ({ id: 1 }),
  updateSessionName: async () => undefined,
};

/* ─────────────────── helpers ─────────────────── */

const JWT_SECRET = 'e2e-secret';

process.env.JWT_ACCESS_SECRET = JWT_SECRET;
process.env.JWT_REFRESH_SECRET = 'stub';

const makeJwt = (jwt: JwtService, userId: number) => jwt.sign({ sub: userId }, { secret: JWT_SECRET, expiresIn: '1h' });

/* ════════════════════════════════════════════════ */

describe('CollaborationSessionGateway (websocket)', () => {
  let app: INestApplication;
  let server: Server;
  let jwt: JwtService;
  let address: string;

  Logger.overrideLogger(false); // quiet output

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      providers: [
        CollaborationSessionGateway,
        { provide: AuthService, useValue: authStub },
        { provide: SessionPresenceService, useValue: presenceStub },
        { provide: MessagesService, useValue: messagesStub },
        { provide: UserCollaborationSessionService, useValue: userSessionStub },
        { provide: CollaborationSessionService, useValue: collabSessionStub },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.listen(0); // random free port

    server = app.getHttpServer();
    address = `http://localhost:${(server.address() as any).port}`;
    jwt = app.get(JwtService);
  });

  afterAll(() => app.close());

  /* ─────────── 1. handshake ─────────── */

  it('rejects connection without cookies', (done) => {
    const s = ioc(address, {
      path: '/collaboration-session-socket',
      autoConnect: false,
      transports: ['websocket'],
    });

    const finish = () => {
      s.close();
      done();
    };

    s.on('connect_error', finish);
    s.on('disconnect', finish);
    s.open();
  });

  it('accepts connection with valid cookies', (done) => {
    const cookieHdr = `accessToken=${makeJwt(jwt, 1)}; refreshToken=dummy`;

    const s = ioc(address, {
      path: '/collaboration-session-socket',
      extraHeaders: { cookie: cookieHdr },
      transports: ['websocket'],
    });

    s.on('connect', () => {
      s.close();
      done();
    });
  });

  /* ─────────── 2. joinSession broadcast ─────────── */

  it('joinSession sets rooms and broadcasts', (done) => {
    const cookieA = `accessToken=${makeJwt(jwt, 42)}; refreshToken=stub`;
    const cookieB = `accessToken=${makeJwt(jwt, 43)}; refreshToken=stub`;

    const clientA = ioc(address, {
      path: '/collaboration-session-socket',
      extraHeaders: { cookie: cookieA },
      transports: ['websocket'],
    });

    const clientB = ioc(address, {
      path: '/collaboration-session-socket',
      extraHeaders: { cookie: cookieB },
      transports: ['websocket'],
    });

    let isCompleted = false;
    const watchdog = setTimeout(() => {
      if (!isCompleted) {
        clientA.close();
        clientB.close();
        done(new Error('newOnlineUser not received in time'));
      }
    }, 2000);

    clientA.on('connect', () => clientA.emit('joinSession', { sessionId: 7 }));
    clientB.on('connect', () => clientB.emit('joinSession', { sessionId: 7 }));

    clientA.on('totalSessionData', () => clientB.open());

    clientA.on('newOnlineUser', (user) => {
      try {
        expect(user.id).toBe(43);
        isCompleted = true;
        clearTimeout(watchdog); // <──--- THIS line fixes the open handle
        clientA.close();
        clientB.close();
        done();
      } catch (err) {
        clearTimeout(watchdog);
        clientA.close();
        clientB.close();
        done(err);
      }
    });
  });

  /* ─────────── 3. sendMessage echo ─────────── */

  it('sendMessage stores and emits newMessage', (done) => {
    const cookie = `accessToken=${makeJwt(jwt, 55)}; refreshToken=stub`;
    const client = ioc(address, {
      path: '/collaboration-session-socket',
      extraHeaders: { cookie },
      transports: ['websocket'],
    });

    const timeout = setTimeout(() => {
      client.close();
      done(new Error('newMessage not received'));
    }, 2000);

    client.on('connect', () => {
      client.emit('joinSession', { sessionId: 9 });
      client.emit('sendMessage', { message: 'hello world' });
    });

    client.on('newMessage', (msg) => {
      clearTimeout(timeout); // <--- Очищаем таймер!
      expect(msg.text).toBe('hello world');
      client.close();
      done();
    });
  });
});
