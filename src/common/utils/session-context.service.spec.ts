import { SessionContextService } from './session-context.service';
import { SessionStateService } from '../state/session-state.service';
import { Socket } from 'socket.io';

describe('SessionContextService', () => {
  let service: SessionContextService;
  let mockSessionStateService: SessionStateService;

  beforeEach(() => {
    mockSessionStateService = {
      socketSessionMap: new Map(),
      onlineUsers: new Map(),
    } as SessionStateService;

    service = new SessionContextService(mockSessionStateService);
  });

  it('should return session id when it exists', () => {
    const mockSocket = { id: 'socket1' } as Socket;

    mockSessionStateService.socketSessionMap.set('socket1', 123);

    const result = service.getSessionIdOrThrow(mockSocket);

    expect(result).toBe(123);
  });

  it('should throw error when session id does not exist', () => {
    const mockSocket = { id: 'socket2' } as Socket;

    expect(() => service.getSessionIdOrThrow(mockSocket)).toThrowError('Session ID not found for this socket');
  });
});
