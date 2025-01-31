import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

  async getUserSessions(userId: number, skip: number, take: number) {
    const userCollabSessions =
      await this.userCollaborationSessionService.getUserCollaborationSessions(
        userId,
        skip,
        take,
      );

    const sessionIds = userCollabSessions.map((ucs) => ucs.session.id);

    if (!sessionIds.length) {
      return [];
    }

    const sessions = await this.collaborationSessionRepository.find({
      where: { id: In(sessionIds) },
      relations: {
        userCollaborationSessions: {
          user: true,
        },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        userCollaborationSessions: {
          id: true,
          lastInteracted: true,
          user: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      order: {
        userCollaborationSessions: {
          lastInteracted: 'DESC', // Database-level sorting
        },
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      lastInteracted: session.userCollaborationSessions
        .map((ucs) => ucs.lastInteracted)
        .sort(
          (a, b) =>
            (b ? new Date(b).getTime() : 0) - (a ? new Date(a).getTime() : 0),
        )[0],
      collaborators: session.userCollaborationSessions.map((ucs) => ({
        id: ucs.user.id,
        name: ucs.user.name,
        email: ucs.user.email,
        avatar: ucs.user.avatar,
      })),
    }));
  }

  async createSession(
    userId: number,
    name: string,
  ): Promise<CollaborationSession> {
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }
    const session = this.collaborationSessionRepository.create({
      name,
    });
    const savedSession =
      await this.collaborationSessionRepository.save(session);

    await this.userCollaborationSessionService.createSession(
      userId,
      savedSession.id,
      [Permission.EDIT, Permission.READ, Permission.ADMIN], // Default permissions
    );

    return savedSession;
  }

  async getSession(id: number): Promise<CollaborationSession> {
    const session = await this.collaborationSessionRepository.findOne({
      where: { id },
      relations: {
        userCollaborationSessions: {
          user: true,
        },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,

        userCollaborationSessions: {
          id: true,
          permissions: true,
          timeSpent: true,
          createdAt: true,
          user: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
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
      relations: [
        'documents',
        'userCollaborationSessions',
        'invitations',
      ],
    });

    if (!session) {
      throw new Error(`Collaboration session with ID ${id} not found`);
    }

    return session;
  }
}
