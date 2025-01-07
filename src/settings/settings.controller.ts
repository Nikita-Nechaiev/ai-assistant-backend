import { Controller, Put, Body, Req, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Settings } from './settings.model';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(JwtAuthGuard)
  @Put()
  async updateSettings(@Req() req, @Body() updates: Partial<Settings>) {
    const userId = req.user.id;
    return this.settingsService.updateSettings(userId, updates);
  }
}
