import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.model';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/common/enums/enums';
import { FileService } from 'src/file/file.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly fileService: FileService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    return user;
  }

  async findOrCreateGoogleUser(googleId: string, email: string, name: string, avatar: string | null): Promise<User> {
    let user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      user = this.userRepository.create({
        email,
        name,
        oauthProvider: 'google',
        oauthId: googleId,
        avatar: avatar ? avatar : '/uploads/avatars/default-ava.webp',
        resetToken: '',
        resetTokenExpires: null,
      });
      await this.userRepository.save(user);
    }

    return user;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create({
      name: userData.name,
      email: userData.email,
      passwordHash: userData.passwordHash || null,
      oauthProvider: userData.oauthProvider || null,
      oauthId: userData.oauthId || null,
      roles: userData.roles || [Role.USER],
      avatar: userData.avatar || null,
    });

    return this.userRepository.save(user);
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.find({ order: { createdAt: 'DESC' } });
  }

  async updateResetToken(userId: number, resetToken: string, expires: number): Promise<void> {
    await this.userRepository.update(userId, { resetToken, resetTokenExpires: expires });
  }

  async findByResetToken(token: string): Promise<User | null> {
    const users = await this.userRepository.find();

    for (const user of users) {
      if (await bcrypt.compare(token, user.resetToken)) return user;
    }

    return null;
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.userRepository.update(userId, {
      passwordHash: hashedPassword,
      resetToken: '',
      resetTokenExpires: null,
    });
  }

  async updateProfile(userId: number, dto: { name?: string }, avatarFile?: Express.Multer.File): Promise<User> {
    const user = await this.findById(userId);

    let avatarPath = user.avatar;

    if (avatarFile) {
      avatarPath = await this.fileService.saveAvatarFile(avatarFile);
    }

    await this.userRepository.update(userId, {
      name: dto.name ?? user.name,
      avatar: avatarPath,
    });

    return this.findById(userId);
  }
}
