import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileService {
  private readonly uploadDir = path.join(
    __dirname,
    '..',
    '..',
    'uploads',
    'avatars',
  );
  private readonly defaultAvatar = '/uploads/avatars/default-ava.webp';

  constructor() {
    this.ensureUploadDirectoryExists();
  }

  private ensureUploadDirectoryExists(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveAvatarFile(avatarFile?: Express.Multer.File): Promise<string> {
    if (!avatarFile) {
      return this.defaultAvatar;
    }

    const fileExtension = path.extname(avatarFile.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(this.uploadDir, fileName);
    const avatarPath = `/uploads/avatars/${fileName}`;

    await fs.promises.writeFile(filePath, avatarFile.buffer);

    return avatarPath;
  }
}
