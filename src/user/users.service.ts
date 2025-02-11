import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, User } from './user.model';
import * as bcrypt from 'bcrypt';
import { SettingsService } from 'src/settings/settings.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    // private readonly analyticsSummaryService: AnalyticsSummaryService,
    // private readonly settingsService: SettingsService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findOrCreateGoogleUser(
    googleId: string,
    email: string,
    name: string,
    avatar: string | null,
  ): Promise<User> {
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

    const savedUser = await this.userRepository.save(user);

    // const settings =
    //   await this.settingsService.createDefaultSettings(savedUser);
    // const analyticsSummary =
    //   await this.analyticsSummaryService.createBaseAnalytics(savedUser);

    // savedUser.settings = settings;
    // savedUser.analyticsSummary = analyticsSummary;

    const finalUser = await this.userRepository.save(savedUser);

    return finalUser;
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.find();
  }

  async updateResetToken(
    userId: number,
    resetToken: string,
    expires: number,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      resetToken,
      resetTokenExpires: expires,
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    const users = await this.userRepository.find();
    for (const user of users) {
      console.log(user);
      if (await bcrypt.compare(token, user.resetToken)) {
        return user;
      }
    }
    return null;
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    console.log('hashedPassword', hashedPassword);
    await this.userRepository.update(userId, {
      passwordHash: hashedPassword,
      resetToken: '',
      resetTokenExpires: null,
    });
  }
}
