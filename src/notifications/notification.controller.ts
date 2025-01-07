import {
  Controller,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationStatus, NotificationType } from './notification.model';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllNotificationsForUser(@Req() req) {
    const userId = req.user.id; // ID пользователя из JWT токена
    return this.notificationService.getAllNotificationsForUser(userId);
  }

  @Post()
  async createNotification(
    @Body('userId') userId: number,
    @Body('title') title: string,
    @Body('text') text: string,
    @Body('type') type: NotificationType,
    @Body('senderEmail') senderEmail?: string,
  ) {
    return this.notificationService.createNotification(
      userId,
      title,
      text,
      type,
      senderEmail,
    );
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: number) {
    return this.notificationService.deleteNotification(id);
  }

  @Put(':id/status')
  async updateNotificationStatus(
    @Param('id') id: number,
    @Body('status') status: NotificationStatus,
  ) {
    return this.notificationService.updateNotificationStatus(id, status);
  }
}
