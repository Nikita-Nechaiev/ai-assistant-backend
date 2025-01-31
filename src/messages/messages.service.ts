import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/user.model';
import { CollaborationSession } from 'src/collaboration-session/collaboration-session.model';
import { Message } from './messages.model';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async createMessage(
    sender: User,
    collaborationSession: CollaborationSession,
    text: string,
  ): Promise<Message> {
    // Create and save the message
    const message = this.messageRepository.create({
      sender,
      collaborationSession: { id: collaborationSession.id },
      text,
    });

    await this.messageRepository.save(message);

    // Use QueryBuilder to control the fetched fields explicitly
    return this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender') // Join sender relation
      .select([
        'message.id',
        'message.text',
        'message.createdAt',
        'sender.id',
        'sender.name',
        'sender.email',
        'sender.avatar', // Include only the required sender fields
      ])
      .where('message.id = :id', { id: message.id })
      .getOne();
  }

  async getMessagesForSession(
    collaborationSession: CollaborationSession,
  ): Promise<Message[]> {
    return this.messageRepository.find({
      where: { collaborationSession: { id: collaborationSession.id } },
      order: { createdAt: 'ASC' },
    });
  }
}
