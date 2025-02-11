import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserCollaborationSession,
  Permission,
} from './user-collaboration-session.model';
import { UsersService } from 'src/user/users.service';

@Injectable()
export class UserCollaborationSessionService {
  constructor(
    @InjectRepository(UserCollaborationSession)
    private readonly userCollabSessionRepository: Repository<UserCollaborationSession>,
    private readonly userService: UsersService,
  ) {}

  async getUserCollaborationSessions(
    userId: number,
    skip: number = 0,
    take: number = 25,
  ): Promise<UserCollaborationSession[]> {
    const userCollabSessions = await this.userCollabSessionRepository.find({
      where: { user: { id: userId } },
      relations: ['session'],
      skip,
      take,
      order: { id: 'ASC' },
    });

    return userCollabSessions;
  }

  async createSession(
    userId: number,
    sessionId: number,
    permissions: Permission[] = [Permission.READ],
  ): Promise<UserCollaborationSession> {
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!sessionId) {
      throw new Error('Collaboration Session not found');
    }

    const userCollabSession = this.userCollabSessionRepository.create({
      user,
      session: { id: sessionId },
      permissions,
    });

    return this.userCollabSessionRepository.save(userCollabSession);
  }

  async updateTimeSpent(
    userId: number,
    sessionId: number,
    timeSpent: number,
  ): Promise<UserCollaborationSession> {
    const session = await this.findByUserAndSession(userId, sessionId);

    if (!session) {
      throw new Error('User Collaboration Session not found');
    }

    session.timeSpent = Math.round(Number(session.timeSpent) + timeSpent);

    await this.userCollabSessionRepository.save(session);

    return session;
  }

  async updateLastInteracted(
    userId: number,
    sessionId: number,
    date: Date,
  ): Promise<UserCollaborationSession> {
    const session = await this.findByUserAndSession(userId, sessionId);

    if (!session) {
      throw new Error('User Collaboration Session not found');
    }

    session.lastInteracted = date;

    return this.userCollabSessionRepository.save(session);
  }

  async updatePermissions(
    sessionId: number,
    permissions: Permission[],
  ): Promise<UserCollaborationSession> {
    const session = await this.userCollabSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('User Collaboration Session not found');
    }

    session.permissions = permissions;
    return this.userCollabSessionRepository.save(session);
  }

  async deleteSession(sessionId: number): Promise<void> {
    const session = await this.userCollabSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('User Collaboration Session not found');
    }

    await this.userCollabSessionRepository.remove(session);
  }

  async findByUserAndSession(
    userId: number,
    sessionId: number,
  ): Promise<UserCollaborationSession> {
    return this.userCollabSessionRepository.findOne({
      where: { user: { id: userId }, session: { id: sessionId } },
    });
  }
}
