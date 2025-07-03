import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCollaborationSession } from './user-collaboration-session.model';
import { UsersService } from 'src/user/users.service';
import { Permission } from 'src/common/enums/enums';

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
    return this.userCollabSessionRepository.find({
      where: { user: { id: userId } },
      relations: ['session'],
      skip,
      take,
      order: { id: 'ASC' },
    });
  }

  async createSession(
    userId: number,
    sessionId: number,
    permissions: Permission[] = [Permission.READ],
  ): Promise<UserCollaborationSession> {
    const user = await this.userService.findById(userId);

    if (!sessionId) {
      throw new BadRequestException('Collaboration Session not found');
    }

    const userCollabSession = this.userCollabSessionRepository.create({
      user,
      session: { id: sessionId },
      permissions,
    });

    return this.userCollabSessionRepository.save(userCollabSession);
  }

  private async getUserCollabSessionOrThrow(userId: number, sessionId: number): Promise<UserCollaborationSession> {
    const session = await this.userCollabSessionRepository.findOne({
      where: { user: { id: userId }, session: { id: sessionId } },
    });

    if (!session) {
      throw new NotFoundException('User Collaboration Session not found');
    }

    return session;
  }

  async updateTimeSpent(userId: number, sessionId: number, timeSpent: number): Promise<UserCollaborationSession> {
    const session = await this.getUserCollabSessionOrThrow(userId, sessionId);

    const currentTimeSpent = session.timeSpent ? Number(session.timeSpent) : 0;

    session.timeSpent = Math.round(currentTimeSpent + timeSpent);

    return this.userCollabSessionRepository.save(session);
  }

  async updateLastInteracted(userId: number, sessionId: number, date: Date): Promise<UserCollaborationSession> {
    const session = await this.getUserCollabSessionOrThrow(userId, sessionId);

    session.lastInteracted = date;

    return this.userCollabSessionRepository.save(session);
  }

  async updatePermissions(sessionId: number, permissions: Permission[]): Promise<UserCollaborationSession> {
    const session = await this.userCollabSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('User Collaboration Session not found');
    }

    session.permissions = permissions;

    return this.userCollabSessionRepository.save(session);
  }

  async deleteSession(sessionId: number): Promise<void> {
    const session = await this.userCollabSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('User Collaboration Session not found');
    }

    await this.userCollabSessionRepository.remove(session);
  }

  async findByUserAndSession(userId: number, sessionId: number): Promise<UserCollaborationSession> {
    return this.userCollabSessionRepository.findOne({
      where: { user: { id: userId }, session: { id: sessionId } },
      relations: ['user'],
    });
  }
}
