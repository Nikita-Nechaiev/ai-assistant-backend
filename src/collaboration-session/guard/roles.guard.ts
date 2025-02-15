import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from 'src/user-collaboration-session/user-collaboration-session.model';
import { UserCollaborationSessionService } from 'src/user-collaboration-session/user-collaboration-session.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userCollaborationSessionService: UserCollaborationSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<Permission[]>(
      'permissions',
      context.getHandler(),
    );
    if (!requiredPermissions) {
      return true;
    }

    const client = context.switchToWs().getClient();
    const userId = client.data.userId;
    const sessionId =
      client.handshake.query.sessionId || client.handshake.headers.sessionid;

    if (!userId || !sessionId) {
      throw new ForbiddenException('User or session ID not found');
    }

    const userSession =
      await this.userCollaborationSessionService.findByUserAndSession(
        userId,
        Number(sessionId),
      );

    if (!userSession) {
      throw new ForbiddenException('User is not part of this session');
    }

    const hasPermission = requiredPermissions.some((perm) =>
      userSession.permissions.includes(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
