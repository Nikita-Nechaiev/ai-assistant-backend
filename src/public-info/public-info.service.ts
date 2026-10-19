import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

@Injectable()
export class PublicInfoService {
  async getCv(): Promise<Buffer> {
    try {
      return await readFile(join(__dirname, 'assets', 'Mykyta-Nechaiev-CV.pdf'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('Resume is currently unavailable.');
      }

      throw error;
    }
  }
}
