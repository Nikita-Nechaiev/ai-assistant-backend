import { Injectable } from '@nestjs/common';
import { SessionStateService } from 'src/common/state/session-state.service';
import { CollaborationSessionService } from 'src/collaboration-session/collaboration-session.service';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { Socket } from 'socket.io';

@Injectable()
export class SessionPresenceService {
  constructor(
    private readonly state: SessionStateService,
    private readonly sessionService: CollaborationSessionService,
    private readonly userSessionService: UserCollaborationSessionService,
  ) {}

  getSessionIdBySocket(socketId: string): number | undefined {
    return this.state.socketSessionMap.get(socketId);
  }

  async join(client: Socket, sessionId: number) {
    const socketId = client.id;
    const userId = client.data.userId;

    this.state.socketSessionMap.set(socketId, sessionId);

    const userSession = await this.userSessionService.findByUserAndSession(userId, sessionId);

    if (!userSession) return { isAllowed: false };

    const existingOnline = this.state.onlineUsers.get(userId);
    let isFirstJoin = false;

    const now = Date.now();

    if (!existingOnline) {
      isFirstJoin = true;
      this.state.onlineUsers.set(userId, { sessionId, startTime: now, socketIds: new Set([socketId]) });
    } else {
      existingOnline.socketIds.add(socketId);
    }

    const snapshot = await this.getSessionTotalData(client, sessionId);

    const newUser = {
      id: userSession.user.id,
      name: userSession.user.name,
      email: userSession.user.email,
      avatar: userSession.user.avatar,
      permissions: userSession.permissions,
    };

    return {
      isAllowed: true,
      snapshot,
      isFirstJoin,
      newUser,
    };
  }

  async leave(socketId: string, userId: number) {
    const sessionId = this.state.socketSessionMap.get(socketId);

    if (!sessionId) return null;

    const online = this.state.onlineUsers.get(userId);

    if (online) {
      online.socketIds.delete(socketId);

      if (online.socketIds.size === 0) {
        const userSession = await this.userSessionService.findByUserAndSession(userId, sessionId);

        if (userSession) {
          const spent = (Date.now() - online.startTime) / 1000;

          await this.userSessionService.updateTimeSpent(userId, sessionId, spent);
          await this.userSessionService.updateLastInteracted(userId, sessionId, new Date());
        }

        this.state.onlineUsers.delete(userId);
      }
    }

    this.state.socketSessionMap.delete(socketId);

    return sessionId;
  }

  async getSessionData(sessionId: number) {
    return this.sessionService.getSession(sessionId);
  }

  async getOnlineUsers(sessionId: number) {
    const sessionData = await this.getSessionData(sessionId);

    const onlineUserSessions = sessionData.userCollaborationSessions.filter((ucs) => {
      const online = this.state.onlineUsers.get(ucs.user.id);

      return online && online.sessionId === sessionId;
    });

    const users = onlineUserSessions.map((ucs) => ({
      id: ucs.user.id,
      name: ucs.user.name,
      email: ucs.user.email,
      avatar: ucs.user.avatar,
      permissions: ucs.permissions,
    }));

    return users;
  }

  async getTimeUserSpent(sessionId: number, client: Socket) {
    const userId = client.data.userId;
    const socketId = client.id;

    const userSession = await this.userSessionService.findByUserAndSession(userId, sessionId);

    if (!userSession) return;

    const initialSeconds = Number(userSession.timeSpent);
    const now = Date.now();
    const online = this.state.onlineUsers.get(userId);

    let totalTime = initialSeconds;

    if (!online) {
      this.state.onlineUsers.set(userId, {
        sessionId,
        startTime: now,
        socketIds: new Set([socketId]),
      });
    } else {
      totalTime += (now - online.startTime) / 1000;
      online.socketIds.add(socketId);
    }

    return totalTime;
  }

  async getSessionTotalData(client: Socket, sessionId: number) {
    if (!sessionId) {
      return;
    }

    const sessionData = await this.getSessionData(sessionId);

    const users = await this.getOnlineUsers(sessionId);

    const timeSpent = await this.getTimeUserSpent(sessionId, client);

    return { sessionData, users, timeSpent };
  }
}
