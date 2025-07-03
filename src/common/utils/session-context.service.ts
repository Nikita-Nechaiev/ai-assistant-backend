import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { SessionStateService } from 'src/common/state/session-state.service';

@Injectable()
export class SessionContextService {
  constructor(private readonly sessionStateService: SessionStateService) {}

  getSessionIdOrThrow(client: Socket): number {
    const sessionId = this.sessionStateService.socketSessionMap.get(client.id);

    if (!sessionId) throw new Error('Session ID not found for this socket');

    return sessionId;
  }
}
