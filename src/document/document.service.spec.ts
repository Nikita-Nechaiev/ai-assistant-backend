import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentService } from './document.service';
import { Document } from './document.model';
import { VersionService } from 'src/version/version.service';
import { Version } from 'src/version/version.model';
import { NotFoundException } from '@nestjs/common';

const repoFactory = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

const versionMock = {
  createVersion: jest.fn(),
  findById: jest.fn(),
};

describe('DocumentService', () => {
  let svc: DocumentService;
  let repo: jest.Mocked<Repository<Document>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mod = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: getRepositoryToken(Document), useFactory: repoFactory },
        { provide: VersionService, useValue: versionMock },
      ],
    }).compile();

    svc = mod.get(DocumentService);
    repo = mod.get(getRepositoryToken(Document));
  });

  it('returns document or throws', async () => {
    repo.findOne.mockResolvedValue({ id: 1 } as unknown as Document);
    expect(await svc.findById(1)).toEqual({ id: 1 });

    repo.findOne.mockResolvedValue(null);
    await expect(svc.findById(2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changes title when document exists', async () => {
    const doc = { id: 5, title: 'Old' } as unknown as Document;

    repo.findOne.mockResolvedValue(doc);
    repo.save.mockResolvedValue({ ...doc, title: 'New' } as unknown as Document);

    const res = await svc.changeDocumentTitle(5, 'New');

    expect(repo.save).toHaveBeenCalledWith({ ...doc, title: 'New' });
    expect(res.title).toBe('New');
  });

  it('throws when changing title on missing doc', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.changeDocumentTitle(55, 'X')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates document and first version', async () => {
    repo.create.mockReturnValue({} as any);
    repo.save.mockResolvedValue({ id: 7, richContent: ' ', title: 'Doc' } as unknown as Document);
    versionMock.createVersion.mockResolvedValue({ id: 99 } as Version);

    const out = await svc.createDocument(3, 'u@mail', 'Doc');

    expect(repo.create).toHaveBeenCalledWith({
      title: 'Doc',
      richContent: ' ',
      collaborationSession: { id: 3 },
    });
    expect(versionMock.createVersion).toHaveBeenCalledWith({ id: 7, richContent: ' ', title: 'Doc' }, ' ', 'u@mail');
    expect(out).toEqual({ document: { id: 7, richContent: ' ', title: 'Doc' }, version: { id: 99 } });
  });

  it('duplicates when original exists', async () => {
    const original = {
      id: 4,
      title: 'Orig',
      richContent: 'X',
      collaborationSession: { id: 1 },
    } as Document;

    repo.findOne.mockResolvedValueOnce(original);
    repo.create.mockReturnValue({} as any);
    repo.save.mockResolvedValue({
      id: 8,
      title: 'Orig (Copy)',
      richContent: 'X',
    } as unknown as Document);
    versionMock.createVersion.mockResolvedValue({ id: 100 } as Version);

    const res = await svc.duplicateDocument(4, 'u@mail');

    expect(repo.create).toHaveBeenCalledWith({
      title: 'Orig (Copy)',
      richContent: 'X',
      collaborationSession: original.collaborationSession,
    });
    expect(res.document.id).toBe(8);
  });

  it('throws when duplicating missing document', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(svc.duplicateDocument(44, 'x@mail')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates content and creates new version', async () => {
    const doc = { id: 9, richContent: 'old' } as unknown as Document;

    repo.findOne.mockResolvedValue(doc);
    repo.save.mockResolvedValue({ ...doc, richContent: 'new' } as unknown as Document);
    versionMock.createVersion.mockResolvedValue({ id: 77 } as Version);

    const result = await svc.changeContentAndSaveDocument(9, 'new', 'u@mail');

    expect(repo.save).toHaveBeenCalled();
    expect(versionMock.createVersion).toHaveBeenCalledWith({ id: 9, richContent: 'new' }, 'new', 'u@mail');
    expect(result.version.id).toBe(77);
  });

  it('throws when changing content on missing doc', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.changeContentAndSaveDocument(9, 'X', 'u@mail')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gets documents by session id', async () => {
    repo.find.mockResolvedValue([{ id: 1 }] as any);
    await svc.getSessionDocuments(5);
    expect(repo.find).toHaveBeenCalledWith({
      where: { collaborationSession: { id: 5 } },
      order: { lastUpdated: 'DESC' },
    });
  });

  it('applies version to document', async () => {
    const doc = { id: 2, richContent: 'A' } as unknown as Document;

    repo.findOne.mockResolvedValue(doc);
    versionMock.findById.mockResolvedValue({
      id: 50,
      richContent: 'B',
      document: { id: 2 },
    } as Version);
    repo.save.mockResolvedValue({ ...doc, richContent: 'B' } as unknown as Document);
    versionMock.createVersion.mockResolvedValue({ id: 51 } as Version);

    const res = await svc.applyVersion(2, 50, 'u@mail');

    expect(res.document.richContent).toBe('B');
    expect(res.version.id).toBe(51);
  });

  it('throws when version belongs to another doc', async () => {
    repo.findOne.mockResolvedValue({ id: 3 } as Document);
    versionMock.findById.mockResolvedValue({
      id: 60,
      richContent: 'X',
      document: { id: 99 },
    } as Version);

    await expect(svc.applyVersion(3, 60, 'u@mail')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when applying version on missing document', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.applyVersion(10, 11, 'u@mail')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when version not found for document', async () => {
    repo.findOne.mockResolvedValue({ id: 3 } as Document);
    versionMock.findById.mockResolvedValue(null);

    await expect(svc.applyVersion(3, 66, 'u@mail')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes document when it exists', async () => {
    repo.findOne.mockResolvedValue({ id: 12 } as Document);
    repo.remove.mockResolvedValue(undefined);

    await svc.deleteDocument(12);
    expect(repo.remove).toHaveBeenCalled();
  });

  it('throws when deleting missing doc', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.deleteDocument(13)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates lastUpdated timestamp', async () => {
    const doc = { id: 14, lastUpdated: new Date('2020-01-01') } as unknown as Document;

    repo.findOne.mockResolvedValue(doc);
    repo.save.mockImplementation((d) => Promise.resolve({ ...d } as Document));

    const res = await svc.updateLastUpdated(14);

    expect(res.lastUpdated.getTime()).toBeGreaterThan(new Date('2020-01-01').getTime());
  });

  it('throws when updating lastUpdated on missing doc', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.updateLastUpdated(20)).rejects.toBeInstanceOf(NotFoundException);
  });
});
