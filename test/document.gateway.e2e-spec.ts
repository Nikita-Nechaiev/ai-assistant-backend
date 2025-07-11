/* test/document.gateway.e2e-spec.ts
 * Integration tests for DocumentGateway
 * ───────────────────────────────────── */

import { Test } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as cookieParser from 'cookie-parser';
import { Server } from 'http';
import { io as ioc, Socket } from 'socket.io-client';

import { DocumentGateway } from 'src/document/document.gateway';
import { DocumentService } from 'src/document/document.service';
import { UsersService } from 'src/user/users.service';
import { VersionService } from 'src/version/version.service';
import { SessionContextService } from 'src/common/utils/session-context.service';
import { AiToolFacadeService } from 'src/document/utils/ai-tool-facade.service';
import { AiTool } from 'src/common/enums/enums';

/* ─────────────── stubs ─────────────── */

const SESSION_ID = 7;

const docStub = {
  changeDocumentTitle: async (_: number, t: string) => ({ id: 1, title: t }) as any,
  createDocument: async () => ({
    document: { id: 2, title: 'BrandNew' } as any,
    version: { id: 20, name: 'v1' } as any,
  }),
  updateLastUpdated: async () => null,
  getSessionDocuments: async () => [{ id: 1, title: 'Doc-A' }] as any,
} as unknown as Partial<DocumentService>;

const userStub = {
  findById: async (id: number) => ({ id, email: `u${id}@mail.com` }),
} as unknown as Partial<UsersService>;

const versionStub = {
  getVersionsByDocument: async () => [{ id: 1, name: 'v1' }],
} as unknown as Partial<VersionService>;

const ctxStub = {
  getSessionIdOrThrow: () => SESSION_ID,
} as unknown as Partial<SessionContextService>;

const aiFacadeStub = {
  executeTool: async () => ({ tool: AiTool.USAGE, runs: 3 }),
} as unknown as Partial<AiToolFacadeService>;

/* ───────────── JWT ───────────── */

const JWT_SECRET = 'doc-gw-secret';

process.env.JWT_ACCESS_SECRET = JWT_SECRET;

const makeJwt = (js: JwtService, uid: number) => js.sign({ sub: uid }, { secret: JWT_SECRET, expiresIn: '1h' });

/* ─────────────────────────────── */

describe('DocumentGateway (websocket)', () => {
  let app: INestApplication;
  let server: Server;
  let jwt: JwtService;
  let url: string;

  Logger.overrideLogger(false);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      providers: [
        DocumentGateway,
        { provide: DocumentService, useValue: docStub },
        { provide: UsersService, useValue: userStub },
        { provide: VersionService, useValue: versionStub },
        { provide: SessionContextService, useValue: ctxStub },
        { provide: AiToolFacadeService, useValue: aiFacadeStub },
      ],
    }).compile();

    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.listen(0);

    server = app.getHttpServer();
    url = `http://localhost:${(server.address() as any).port}`;
    jwt = app.get(JwtService);

    // broadcast-helper
    (mod.get(DocumentGateway) as any).server.to = () => (mod.get(DocumentGateway) as any).server;
  });

  afterAll(() => app.close());

  const connect = (uid = 1): Socket =>
    ioc(url, {
      path: '/collaboration-session-socket',
      extraHeaders: {
        cookie: `accessToken=${makeJwt(jwt, uid)}; refreshToken=stub`,
      },
      transports: ['websocket'],
    });

  /* ───────── tests ───────── */

  it('changeDocumentTitle → documentUpdated', async () => {
    const socket = connect();

    const doc = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('documentUpdated not received'));
      }, 2000);

      socket.on('documentUpdated', (d) => {
        clearTimeout(timer);
        resolve(d);
        socket.close();
      });

      socket.on('connect', () =>
        socket.emit('changeDocumentTitle', {
          documentId: 1,
          newTitle: 'New Title',
        }),
      );
    });

    expect(doc).toEqual({ id: 1, title: 'New Title' });
  });

  it('createDocument → documentCreated + versionCreated', async () => {
    const socket = connect(2);

    const { document, version } = await new Promise<any>((resolve, reject) => {
      const result: any = {};
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('events not received'));
      }, 2000);

      const maybeDone = () => {
        if (result.document && result.version) {
          clearTimeout(timer);
          resolve(result);
          socket.close();
        }
      };

      socket.on('documentCreated', (d) => {
        result.document = d;
        maybeDone();
      });
      socket.on('versionCreated', (v) => {
        result.version = v;
        maybeDone();
      });

      socket.on('connect', () => socket.emit('createDocument', { title: 'BrandNew' }));
    });

    expect(document).toEqual({ id: 2, title: 'BrandNew' });
    expect(version).toEqual({ id: 20, name: 'v1' });
  });

  it('getSessionDocuments → sessionDocuments', async () => {
    const socket = connect(3);

    const docs = await new Promise<any[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('sessionDocuments not received'));
      }, 2000);

      socket.on('sessionDocuments', (d) => {
        clearTimeout(timer);
        resolve(d);
        socket.close();
      });

      socket.on('connect', () => socket.emit('getSessionDocuments', { sessionId: SESSION_ID }));
    });

    expect(docs[0]).toHaveProperty('title', 'Doc-A');
  });

  it('invalid getDocument → invalidDocument', async () => {
    const socket = connect(4);

    const payload = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('invalidDocument not received'));
      }, 2000);

      socket.on('invalidDocument', (p) => {
        clearTimeout(timer);
        resolve(p);
        socket.close();
      });

      socket.on('connect', () => socket.emit('getDocument', { documentId: 999 }));
    });

    expect(payload).toEqual({
      message: expect.any(String),
      documentId: 999,
    });
  });
});
