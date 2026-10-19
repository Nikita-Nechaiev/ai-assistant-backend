import { readFile } from 'node:fs/promises';
import { NotFoundException } from '@nestjs/common';
import { PublicInfoService } from './public-info.service';

jest.mock('node:fs/promises', () => ({ readFile: jest.fn() }));

const read = readFile as jest.Mock;

describe('PublicInfoService', () => {
  const service = new PublicInfoService();

  afterEach(() => jest.resetAllMocks());
  it('returns the bundled PDF bytes without transforming them', async () => {
    const pdf = Buffer.from('%PDF-1.7 resume');

    read.mockResolvedValue(pdf);
    await expect(service.getCv()).resolves.toBe(pdf);
    expect(read).toHaveBeenCalledWith(expect.stringMatching(/public-info\/assets\/Mykyta-Nechaiev-CV\.pdf$/));
  });
  it('maps a missing resume to HTTP 404', async () => {
    read.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    await expect(service.getCv()).rejects.toBeInstanceOf(NotFoundException);
  });
  it('preserves unexpected storage errors', async () => {
    const error = Object.assign(new Error('denied'), { code: 'EACCES' });

    read.mockRejectedValue(error);
    await expect(service.getCv()).rejects.toBe(error);
  });
});
