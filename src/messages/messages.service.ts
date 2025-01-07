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
    const message = this.messageRepository.create({
      sender,
      collaborationSession,
      text,
    });
    return this.messageRepository.save(message);
  }

  async getMessagesForSession(
    collaborationSession: CollaborationSession,
  ): Promise<Message[]> {
    return this.messageRepository.find({
      where: { collaborationSession },
      order: { createdAt: 'ASC' },
    });
  }
}
