import { FileService } from './file.service';
import * as path from 'path';

jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid-123') }));

const existsSyncMock = jest.fn();
const mkdirSyncMock = jest.fn();
const writeFileMock = jest.fn();

jest.mock('fs', () => ({
  existsSync: (...args: any[]) => existsSyncMock(...args),
  mkdirSync: (...args: any[]) => mkdirSyncMock(...args),
  promises: {
    writeFile: (...args: any[]) => writeFileMock(...args),
  },
}));

describe('FileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates upload directory if it does not exist', () => {
    existsSyncMock.mockReturnValueOnce(false);

    const svc = new FileService();

    expect(existsSyncMock).toHaveBeenCalled();
    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('returns default avatar path when file is undefined', async () => {
    existsSyncMock.mockReturnValue(true);

    const svc = new FileService();

    const res = await svc.saveAvatarFile(undefined);

    expect(res).toBe('/uploads/avatars/default-ava.webp');
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('saves file and returns path with uuid filename', async () => {
    existsSyncMock.mockReturnValue(true);

    const svc = new FileService();

    const fakeFile = {
      originalname: 'photo.png',
      buffer: Buffer.from('dummy'),
    } as Express.Multer.File;

    const returned = await svc.saveAvatarFile(fakeFile);

    expect(returned).toBe('/uploads/avatars/uuid-123.png');

    const expectedFullPath = path.join(svc['uploadDir'], 'uuid-123.png');

    expect(writeFileMock).toHaveBeenCalledWith(expectedFullPath, fakeFile.buffer);
  });
});
