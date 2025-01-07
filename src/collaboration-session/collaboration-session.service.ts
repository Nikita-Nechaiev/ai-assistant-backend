import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaborationSession } from './collaboration-session.model';
import { UsersService } from 'src/user/users.service';
import { Permission } from 'src/user-collaboration-session/user-collaboration-session.model';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';

@Injectable()
export class CollaborationSessionService {
  constructor(
    @InjectRepository(CollaborationSession)
    private readonly collaborationSessionRepository: Repository<CollaborationSession>,
    private readonly userService: UsersService,
    private readonly userCollaborationSessionService: UserCollaborationSessionService,
  ) {}

  async createSession(
    userId: number,
    name?: string,
  ): Promise<CollaborationSession> {
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Generate the session name if not provided
    const sessionName = name || `${user.name}'s session`;

    // Create and save the collaboration session
    const session = this.collaborationSessionRepository.create({
      name: sessionName,
    });
    const savedSession =
      await this.collaborationSessionRepository.save(session);

    // Automatically link the user to the session
    await this.userCollaborationSessionService.createSession(
      userId,
      savedSession.id,
      [Permission.EDIT, , Permission.READ, Permission.ADMIN], // Default permissions
    );

    return savedSession;
  }

  async getSession(id: number): Promise<CollaborationSession> {
    const session = await this.collaborationSessionRepository.findOne({
      where: { id },
      relations: ['documents', 'userCollaborationSessions', 'invitations'],
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return session;
  }

  async updateSessionName(
    id: number,
    name: string,
  ): Promise<CollaborationSession> {
    const session = await this.collaborationSessionRepository.findOne({
      where: { id },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    session.name = name;
    return this.collaborationSessionRepository.save(session);
  }

  async findById(id: number): Promise<CollaborationSession> {
    const session = await this.collaborationSessionRepository.findOne({
      where: { id },
      relations: ['documents', 'userCollaborationSessions', 'invitations'],
    });

    if (!session) {
      throw new Error(`Collaboration session with ID ${id} not found`);
    }

    return session;
  }
}
