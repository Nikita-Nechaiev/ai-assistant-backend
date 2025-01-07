import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings, Theme } from './settings.model';
import { User } from 'src/user/user.model';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
  ) {}

  async createDefaultSettings(user: User): Promise<Settings> {
    const defaultSettings = this.settingsRepository.create({
      user,
      autoSave: true,
      soundNotifications: true,
      theme: Theme.SYSTEM,
      animatedInput: true,
      preferredFont: 'Times New Roman',
      fontSize: 18,
      fontWeight: 500,
    });

    const savedSettings = await this.settingsRepository.save(defaultSettings);
    return savedSettings;
  }

  async updateSettings(
    userId: number,
    updates: Partial<Settings>,
  ): Promise<Settings> {
    const settings = await this.settingsRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!settings) {
      throw new Error('Settings not found for this user');
    }

    Object.assign(settings, updates);
    return this.settingsRepository.save(settings);
  }
}
