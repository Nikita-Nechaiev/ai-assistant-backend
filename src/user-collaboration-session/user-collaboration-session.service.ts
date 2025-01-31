import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserCollaborationSession,
  Permission,
} from './user-collaboration-session.model';
import { UsersService } from 'src/user/users.service';
import { AnalyticsSummaryService } from 'src/analytics-summary/analytics-summary.service'; // Assuming this service exists

@Injectable()
export class UserCollaborationSessionService {
  constructor(
    @InjectRepository(UserCollaborationSession)
    private readonly userCollabSessionRepository: Repository<UserCollaborationSession>,
    private readonly userService: UsersService,
    // private readonly analyticsSummaryService: AnalyticsSummaryService, // Injected AnalyticsSummaryService
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

    // const hoursSpent = timeSpent / (1000 * 60 * 60); // Convert milliseconds to hours

    // await this.analyticsSummaryService.updateAnalytics(userId, {
    //   activeHours:
    //     (session.user.analyticsSummary.activeHours || 0) + hoursSpent,
    // });

    return session;
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

    // Decrement totalSessions in AnalyticsSummary
    // await this.analyticsSummaryService.updateAnalytics(session.user.id, {
    //   totalSessions: Math.max(
    //     0,
    //     session.user.analyticsSummary.totalSessions - 1,
    //   ),
    // });

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
