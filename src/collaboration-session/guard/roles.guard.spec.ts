import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';
import { Permission } from 'src/common/enums/enums';

describe('RolesGuard', () => {
  const reflector = {
    get: jest.fn(),
  } as unknown as Reflector;

  const userCollaborationSessionService = {
    findByUserAndSession: jest.fn(),
  } as unknown as UserCollaborationSessionService;

  let guard: RolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(reflector, userCollaborationSessionService);
  });

  const createMockContext = (userId?: number, sessionId?: string | number) => {
    return {
      switchToWs: () => ({
        getClient: () => ({
          data: { userId },
          handshake: {
            query: { sessionId },
            headers: { sessionid: sessionId },
          },
        }),
      }),
      getHandler: () => 'mockHandler',
    } as unknown as ExecutionContext;
  };

  it('returns true if no permissions are required', async () => {
    reflector.get = jest.fn().mockReturnValue(undefined);

    const context = createMockContext(1, '10');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws ForbiddenException if userId or sessionId is missing', async () => {
    reflector.get = jest.fn().mockReturnValue([Permission.EDIT]);

    const contextNoUser = createMockContext(undefined, '10');

    await expect(guard.canActivate(contextNoUser)).rejects.toThrow(ForbiddenException);

    const contextNoSession = createMockContext(1, undefined);

    await expect(guard.canActivate(contextNoSession)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException if user is not part of session', async () => {
    reflector.get = jest.fn().mockReturnValue([Permission.EDIT]);

    userCollaborationSessionService.findByUserAndSession = jest.fn().mockResolvedValue(null);

    const context = createMockContext(1, '10');

    await expect(guard.canActivate(context)).rejects.toThrow('User is not part of this session');
  });

  it('throws ForbiddenException if user lacks required permission', async () => {
    reflector.get = jest.fn().mockReturnValue([Permission.EDIT]);

    userCollaborationSessionService.findByUserAndSession = jest.fn().mockResolvedValue({
      permissions: [Permission.READ],
    });

    const context = createMockContext(1, '10');

    await expect(guard.canActivate(context)).rejects.toThrow('You do not have permission to perform this action');
  });

  it('returns true if user has required permission', async () => {
    reflector.get = jest.fn().mockReturnValue([Permission.EDIT]);

    userCollaborationSessionService.findByUserAndSession = jest.fn().mockResolvedValue({
      permissions: [Permission.EDIT, Permission.READ],
    });

    const context = createMockContext(1, '10');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
