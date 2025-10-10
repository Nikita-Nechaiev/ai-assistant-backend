import { Test } from '@nestjs/testing';
import { INestApplication, Logger, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as cookieParser from 'cookie-parser';
import { Server } from 'http';
import { io as ioc, Socket } from 'socket.io-client';

import { InvitationGateway } from 'src/invitation/invitation.gateway';
import { InvitationService } from 'src/invitation/invitation.service';
import { CreateInvitationUseCase } from 'src/invitation/use-cases/create-invitation.usecase';
import { SessionContextService } from 'src/common/utils/session-context.service';
import { NotificationStatus, Permission, AiTool, InvitationStatus } from 'src/common/enums/enums';
import { Invitation } from 'src/invitation/invitation.model';

const SESSION_ID = 7;
const RECEIVER_ID = 2;
const INVITER_ID = 2;

const baseInvitation: Invitation = {
  id: 10,
  role: Permission.READ,
  invitationStatus: InvitationStatus.PENDING,
  notificationStatus: NotificationStatus.UNREAD,
  date: new Date(),
  expiresAt: null,
  inviterEmail: 'inviter@mail.com',

  session: { id: SESSION_ID } as any,
  receiver: { id: RECEIVER_ID } as any,
};

const invitationStub: Partial<InvitationService> = {
  findByReceiverId: async () => [baseInvitation],

  getInvitationsForSession: async () => [baseInvitation],

  update: async (id, dto) =>
    ({
      ...baseInvitation,
      id,
      ...dto,
    }) as Invitation,
  changeInvitationRole: async (id, newRole) => ({
    ...baseInvitation,
    id,
    role: newRole,
  }),

  acceptInvitation: async (id) => ({
    ...baseInvitation,
    id,
    invitationStatus: InvitationStatus.ACCEPTED,
    notificationStatus: NotificationStatus.READ,
  }),

  findById: async (id) => ({ ...baseInvitation, id }),
  delete: async () => undefined,
};

const createInvUseCaseStub: Partial<CreateInvitationUseCase> = {
  execute: async () => ({
    ...baseInvitation,
    id: 11,
    notificationStatus: NotificationStatus.UNREAD,
  }),
};
const ctxStub: Partial<SessionContextService> = {
  getSessionIdOrThrow: () => SESSION_ID,
};

const JWT_SECRET = 'invite-gw-secret';

process.env.JWT_ACCESS_SECRET = JWT_SECRET;

const makeJwt = (js: JwtService, uid: number) => js.sign({ sub: uid }, { secret: JWT_SECRET, expiresIn: '1h' });

describe('InvitationGateway (websocket)', () => {
  let app: INestApplication;
  let server: Server;
  let jwt: JwtService;
  let url: string;

  Logger.overrideLogger(false);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      providers: [
        InvitationGateway,
        { provide: InvitationService, useValue: invitationStub },
        { provide: CreateInvitationUseCase, useValue: createInvUseCaseStub },
        { provide: SessionContextService, useValue: ctxStub },
      ],
    }).compile();

    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.listen(0);

    server = app.getHttpServer();
    url = `http://localhost:${(server.address() as any).port}`;
    jwt = app.get(JwtService);

    const gw = mod.get(InvitationGateway);

    (gw as any).server.use((sock: any, next: any) => {
      try {
        const token = (sock.handshake.headers.cookie ?? '')
          .split(';')
          .find((c) => c.trim().startsWith('accessToken='))!
          .split('=')[1];

        sock.data.userId = (jwt.verify(token, { secret: JWT_SECRET }) as any).sub;
      } catch {}

      next();
    });

    (gw as any).server.to = () => (gw as any).server;
  });

  afterAll(() => app.close());

  const client = (uid: number): Socket =>
    ioc(url, {
      path: '/collaboration-session-socket',
      extraHeaders: {
        cookie: `accessToken=${makeJwt(jwt, uid)}; refreshToken=stub`,
      },
      transports: ['websocket'],
    });

  it('joinDashboard emits notifications', () =>
    new Promise<void>((resolve, reject) => {
      const c = client(RECEIVER_ID);
      const to = setTimeout(() => {
        c.close();
        reject(new Error('notifications not received'));
      }, 1500);

      c.once('connect', () => c.emit('joinDashboard'));
      c.once('notifications', (list) => {
        clearTimeout(to);
        expect(Array.isArray(list)).toBe(true);
        expect(list[0].id).toBe(baseInvitation.id);
        c.close();
        resolve();
      });
    }));

  it('createInvitation → newInvitation broadcast (dashboard + session)', () =>
    new Promise<void>((resolve, reject) => {
      const inviter = client(INVITER_ID);
      const receiver = client(RECEIVER_ID);

      const timer = setTimeout(() => {
        inviter.close();
        receiver.close();
        reject(new Error('newInvitation not received'));
      }, 2000);

      let gotInvFromDashboard = false;
      let gotInvFromSession = false;

      const finish = () => {
        if (gotInvFromDashboard && gotInvFromSession) {
          clearTimeout(timer);
          inviter.close();
          receiver.close();
          resolve();
        }
      };

      inviter.once('connect', () =>
        inviter.emit('createInvitation', {
          email: 'user2@mail.com',
          role: Permission.READ,
        }),
      );

      inviter.once('newInvitation', (inv) => {
        expect(inv.id).toBe(11);
        gotInvFromSession = true;
        finish();
      });
      receiver.once('newInvitation', (inv) => {
        expect(inv.id).toBe(11);
        gotInvFromDashboard = true;
        finish();
      });
    }));

  it('updateNotificationStatus → invitationUpdated', () =>
    new Promise<void>((resolve, reject) => {
      const c = client(RECEIVER_ID);
      const timer = setTimeout(() => {
        c.close();
        reject(new Error('invitationUpdated not received'));
      }, 1500);

      c.once('connect', () =>
        c.emit('updateNotificationStatus', {
          invitationId: baseInvitation.id,
          status: NotificationStatus.READ,
        }),
      );

      c.once('invitationUpdated', (inv) => {
        clearTimeout(timer);
        expect(inv.notificationStatus).toBe(NotificationStatus.READ);
        c.close();
        resolve();
      });
    }));

  it('deleteNotification → notificationDeleted', () =>
    new Promise<void>((resolve, reject) => {
      const c = client(RECEIVER_ID);
      const timer = setTimeout(() => {
        c.close();
        reject(new Error('notificationDeleted not received'));
      }, 1500);

      c.once('connect', () => c.emit('deleteNotification', { invitationId: baseInvitation.id }));
      c.once('notificationDeleted', (p) => {
        clearTimeout(timer);
        expect(p).toEqual({ invitationId: baseInvitation.id });
        c.close();
        resolve();
      });
    }));
});
