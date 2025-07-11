import { DocumentGateway } from './document.gateway';
import { DocumentService } from 'src/document/document.service';
import { UsersService } from 'src/user/users.service';
import { VersionService } from 'src/version/version.service';
import { SessionContextService } from 'src/common/utils/session-context.service';
import { AiToolFacadeService } from 'src/document/utils/ai-tool-facade.service';
import { AiTool } from 'src/common/enums/enums';

/* helpers: fake socket & server                                      */
function fakeSocket(id = 'sock-1', userId = 5) {
  const s: any = {
    id,
    data: { userId },
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn().mockReturnThis(), // chainable: .to().emit()
  };

  return s;
}
function fakeServer() {
  const svr: any = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  return svr;
}

/* mocks for injected services                                        */
const docMock = {
  changeDocumentTitle: jest.fn(),
  createDocument: jest.fn(),
  deleteDocument: jest.fn(),
  duplicateDocument: jest.fn(),
  getSessionDocuments: jest.fn(),
  changeContentAndSaveDocument: jest.fn(),
  applyVersion: jest.fn(),
  updateLastUpdated: jest.fn(),
};
const userMock = { findById: jest.fn() };
const verMock = { getVersionsByDocument: jest.fn() };
const ctxMock = { getSessionIdOrThrow: jest.fn() };
const aiMock = { executeTool: jest.fn() };

/* ------------------------------------------------------------------ */
function buildGw() {
  const gw = new DocumentGateway(docMock as any, userMock as any, verMock as any, ctxMock as any, aiMock as any);

  gw['server'] = fakeServer();

  return gw;
}

/* ------------------------------------------------------------------ */
/*                                 TESTS                              */
/* ------------------------------------------------------------------ */
describe('DocumentGateway (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('changeDocumentTitle updates doc & broadcasts', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(77);
    docMock.changeDocumentTitle.mockResolvedValue({ id: 2, title: 'New' });

    await gw.changeDocumentTitle({ documentId: 2, newTitle: 'New' }, sock as any);

    expect(docMock.changeDocumentTitle).toHaveBeenCalledWith(2, 'New');
    expect(gw['server'].to).toHaveBeenCalledWith('session_77');
    expect(gw['server'].emit).toHaveBeenCalledWith('documentUpdated', { id: 2, title: 'New' });
  });

  it('createDocument creates doc & version and broadcasts both', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(80);
    userMock.findById.mockResolvedValue({ email: 'a@mail' });
    docMock.createDocument.mockResolvedValue({
      document: { id: 9 },
      version: { id: 99 },
    });

    await gw.createDocument({ title: 'Doc' }, sock as any);

    expect(docMock.createDocument).toHaveBeenCalled();
    expect(gw['server'].emit).toHaveBeenCalledWith('documentCreated', { id: 9 });
    expect(gw['server'].emit).toHaveBeenCalledWith('versionCreated', { id: 99 });
  });

  it('getSessionDocuments emits list to requesting client', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    docMock.getSessionDocuments.mockResolvedValue([{ id: 3 }]);

    await gw.getSessionDocuments(1, sock as any);

    expect(docMock.getSessionDocuments).toHaveBeenCalledWith(1);
    expect(sock.emit).toHaveBeenCalledWith('sessionDocuments', [{ id: 3 }]);
  });

  it('getDocumentAiUsage runs facade and broadcasts usage', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(42);
    aiMock.executeTool.mockResolvedValue({ stat: 1 });

    await gw.getDocumentAiUsage({ documentId: 7 }, sock as any);

    expect(aiMock.executeTool).toHaveBeenCalledWith(5, {
      toolName: AiTool.USAGE,
      text: '',
      documentId: 7,
    });
    expect(gw['server'].emit).toHaveBeenCalledWith('documentAiUsage', { stat: 1 });
  });

  it('deleteDocument removes via service and broadcasts', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(11);

    await gw.deleteDocument({ documentId: 3 }, sock as any);

    expect(docMock.deleteDocument).toHaveBeenCalledWith(3);
    expect(gw['server'].to).toHaveBeenCalledWith('session_11');
    expect(gw['server'].emit).toHaveBeenCalledWith('documentDeleted', { documentId: 3 });
  });

  it('duplicateDocument sends duplicate & version to room', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(12);
    userMock.findById.mockResolvedValue({ email: 'u@mail' });
    docMock.duplicateDocument.mockResolvedValue({
      document: { id: 20 },
      version: { id: 21 },
    });

    await gw.duplicateDocument({ documentId: 7 }, sock as any);

    expect(docMock.duplicateDocument).toHaveBeenCalledWith(7, 'u@mail');
    expect(gw['server'].emit).toHaveBeenCalledWith('documentDuplicated', { id: 20 });
    expect(gw['server'].emit).toHaveBeenCalledWith('versionCreated', { id: 21 });
  });

  it('changeContentAndSaveDocument notifies room with doc+version', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(13);
    userMock.findById.mockResolvedValue({ email: 'x@mail' });
    docMock.changeContentAndSaveDocument.mockResolvedValue({
      document: { id: 30 },
      version: { id: 31 },
    });

    await gw.changeContentAndSaveDocument({ documentId: 30, newContent: { ops: [] } }, sock as any);

    expect(docMock.changeContentAndSaveDocument).toHaveBeenCalled();
    expect(gw['server'].emit).toHaveBeenCalledWith('documentUpdated', { id: 30 });
    expect(gw['server'].emit).toHaveBeenCalledWith('versionCreated', { id: 31 });
  });

  it('applyVersion broadcasts updated doc & new version', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(14);
    userMock.findById.mockResolvedValue({ email: 'z@mail' });
    docMock.applyVersion.mockResolvedValue({
      document: { id: 40 },
      version: { id: 41 },
    });

    await gw.applyVersion({ documentId: 40, versionId: 2 }, sock as any);

    expect(docMock.applyVersion).toHaveBeenCalledWith(40, 2, 'z@mail');
    expect(gw['server'].emit).toHaveBeenCalledWith('documentUpdated', { id: 40 });
    expect(gw['server'].emit).toHaveBeenCalledWith('versionCreated', { id: 41 });
  });

  it('getDocument emits invalidDocument when session mismatch', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(999); // текущая сессия
    docMock.updateLastUpdated.mockResolvedValue({
      id: 55,
      collaborationSession: { id: 777 }, // Другая сессия!
    });

    await gw.getDocument({ documentId: 55 }, sock as any);

    expect(sock.emit).toHaveBeenCalledWith('invalidDocument', {
      message: 'Document does not belong to this session',
      documentId: 55,
    });
  });

  it('createDocumentAiUsage broadcasts created usage', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(22);
    aiMock.executeTool.mockResolvedValue({ done: true });

    await gw.createDocumentAiUsage(
      {
        toolName: AiTool.GRAMMAR_CHECK,
        text: 't',
        documentId: 9,
      },
      sock as any,
    );

    expect(aiMock.executeTool).toHaveBeenCalledWith(5, {
      toolName: AiTool.GRAMMAR_CHECK,
      text: 't',
      documentId: 9,
    });
    expect(gw['server'].emit).toHaveBeenCalledWith('documentAiUsageCreated', { done: true });
  });

  it('getDocument → emits "Document not found" when service returns null', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(1);
    docMock.updateLastUpdated.mockResolvedValue(null);

    await gw.getDocument({ documentId: 10 }, sock as any);

    expect(sock.emit).toHaveBeenCalledWith('invalidDocument', {
      message: 'Document not found',
      documentId: 10,
    });
  });

  /* getDocument → throws -> catch branch */
  it('getDocument → catches service error and emits invalidDocument', async () => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(1);
    docMock.updateLastUpdated.mockRejectedValue(new Error('boom'));

    await gw.getDocument({ documentId: 11 }, sock as any);

    expect(sock.emit).toHaveBeenCalledWith('invalidDocument', {
      message: 'boom',
      documentId: 11,
    });
  });

  /* generic helper to test catch-blocks */
  const errorCases: Array<{
    name: string;
    arrange: (gw: DocumentGateway, sock: any) => Promise<void>;
    mocked: jest.Mock;
  }> = [
    {
      name: 'changeDocumentTitle',
      arrange: (gw, s) => gw.changeDocumentTitle({ documentId: 1, newTitle: 'T' }, s),
      mocked: docMock.changeDocumentTitle,
    },
    {
      name: 'createDocument',
      arrange: (gw, s) => gw.createDocument({ title: 'A' }, s),
      mocked: docMock.createDocument,
    },
    {
      name: 'deleteDocument',
      arrange: (gw, s) => gw.deleteDocument({ documentId: 1 }, s),
      mocked: docMock.deleteDocument,
    },
    {
      name: 'duplicateDocument',
      arrange: (gw, s) => gw.duplicateDocument({ documentId: 1 }, s),
      mocked: docMock.duplicateDocument,
    },
    {
      name: 'changeContentAndSaveDocument',
      arrange: (gw, s) => gw.changeContentAndSaveDocument({ documentId: 1, newContent: {} }, s),
      mocked: docMock.changeContentAndSaveDocument,
    },
    {
      name: 'applyVersion',
      arrange: (gw, s) => gw.applyVersion({ documentId: 1, versionId: 2 }, s),
      mocked: docMock.applyVersion,
    },
    {
      name: 'getDocumentAiUsage',
      arrange: (gw, s) => gw.getDocumentAiUsage({ documentId: 1 }, s),
      mocked: aiMock.executeTool,
    },
    {
      name: 'createDocumentAiUsage',
      arrange: (gw, s) => gw.createDocumentAiUsage({ toolName: AiTool.GRAMMAR_CHECK, text: 't', documentId: 1 }, s),
      mocked: aiMock.executeTool,
    },
    {
      name: 'getVersions',
      arrange: (gw, s) => gw.getVersions({ documentId: 1 }, s),
      mocked: verMock.getVersionsByDocument,
    },
    {
      name: 'getSessionDocuments',
      arrange: (gw, s) => gw.getSessionDocuments(1, s),
      mocked: docMock.getSessionDocuments,
    },
  ];

  it.each(errorCases)('$name → emits error on internal failure', async ({ arrange, mocked }) => {
    const gw = buildGw();
    const sock = fakeSocket();

    ctxMock.getSessionIdOrThrow.mockReturnValue(99);
    userMock.findById.mockResolvedValue({ email: 'e@mail' });

    mocked.mockRejectedValue(new Error('fail'));

    await arrange(gw, sock as any);

    expect(sock.emit).toHaveBeenCalledWith('error', 'fail');
  });
});
