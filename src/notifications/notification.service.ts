import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationStatus, NotificationType } from './notification.model';
import { User } from 'src/user/user.model';
import { UsersService } from 'src/user/users.service';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly userService: UsersService,
  ) {}

  async getAllNotificationsForUser(userId: number): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { user: { id: userId } },
      order: { date: 'DESC' }, // Сортировка по дате, начиная с последнего
    });
  }

  async createNotification(
    userId: number,
    title: string,
    text: string,
    type: NotificationType,
    senderEmail?: string,
  ): Promise<Notification> {
    const user = await this.userService.findById(userId)

    if (!user) {
      throw new Error('User not found');
    }

    const notification = this.notificationRepository.create({
      user,
      title,
      text,
      type,
      senderEmail: senderEmail || null,
    });

    return this.notificationRepository.save(notification);
  }

  async deleteNotification(notificationId: number): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await this.notificationRepository.remove(notification);
  }

  async updateNotificationStatus(
    notificationId: number,
    status: NotificationStatus,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.status = status;
    return this.notificationRepository.save(notification);
  }
}
