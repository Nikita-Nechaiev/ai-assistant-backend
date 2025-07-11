import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VersionService } from './version.service';
import { Version } from './version.model';
import { Document } from 'src/document/document.model';
import { NotFoundException } from '@nestjs/common';

const repoFactory = () => ({
  createQueryBuilder: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('VersionService', () => {
  let svc: VersionService;
  let repo: jest.Mocked<Repository<Version>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mod = await Test.createTestingModule({
      providers: [VersionService, { provide: getRepositoryToken(Version), useFactory: repoFactory }],
    }).compile();

    svc = mod.get(VersionService);
    repo = mod.get(getRepositoryToken(Version));
  });

  it('builds correct query and returns versions', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 1 }] as Version[]),
    };

    repo.createQueryBuilder.mockReturnValue(qb as any);

    const res = await svc.getVersionsByDocument(5);

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('version');
    expect(qb.where).toHaveBeenCalledWith('document.id = :documentId', { documentId: 5 });
    expect(qb.getMany).toHaveBeenCalled();
    expect(res).toEqual([{ id: 1 }]);
  });

  describe('createVersion', () => {
    const doc = { id: 10 } as Document;
    const rich1 = { delta: 'A' };
    const rich2 = { delta: 'B' };

    it('returns null when latest version has identical content', async () => {
      repo.findOne.mockResolvedValue({ richContent: rich1 } as unknown as Version);

      const res = await svc.createVersion(doc, rich1, 'u@mail');

      expect(res).toBeNull();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('creates and saves new version on changed content', async () => {
      repo.findOne.mockResolvedValue({ richContent: rich1 } as unknown as Version);
      repo.create.mockReturnValue({} as any);
      repo.save.mockResolvedValue({ id: 2 } as Version);

      const res = await svc.createVersion(doc, rich2, 'u@mail');

      expect(repo.create).toHaveBeenCalledWith({
        document: doc,
        richContent: rich2,
        userEmail: 'u@mail',
      });
      expect(res).toEqual({ id: 2 });
    });
  });

  it('returns version when found', async () => {
    repo.findOne.mockResolvedValue({ id: 3 } as Version);

    const v = await svc.findById(3);

    expect(v.id).toBe(3);
  });

  it('throws NotFoundException when absent', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(svc.findById(9)).rejects.toBeInstanceOf(NotFoundException);
  });
});
