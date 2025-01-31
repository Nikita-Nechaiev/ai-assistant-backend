import { SetMetadata } from '@nestjs/common';
import { Permission } from 'src/user-collaboration-session/user-collaboration-session.model';

export const Roles = (...permissions: Permission[]) =>
  SetMetadata('permissions', permissions);
