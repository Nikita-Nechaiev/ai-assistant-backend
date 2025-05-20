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

  private async getMessageWithSender(messageId: number): Promise<Message> {
    return this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .select([
        'message.id',
        'message.text',
        'message.createdAt',
        'sender.id',
        'sender.name',
        'sender.email',
        'sender.avatar',
      ])
      .where('message.id = :id', { id: messageId })
      .getOne();
  }

  async createMessage(sender: User, collaborationSessionId: number, text: string): Promise<Message> {
    const message = this.messageRepository.create({
      sender,
      collaborationSession: { id: collaborationSessionId },
      text,
    });

    const savedMessage = await this.messageRepository.save(message);

    return this.getMessageWithSender(savedMessage.id);
  }

  async getMessagesForSession(collaborationSession: CollaborationSession): Promise<Message[]> {
    return this.messageRepository.find({
      where: { collaborationSession: { id: collaborationSession.id } },
      order: { createdAt: 'ASC' },
    });
  }
}
