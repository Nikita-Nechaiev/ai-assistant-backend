import { SetMetadata } from '@nestjs/common';
import { Permission } from 'src/common/enums/enums';

export const Roles = (...permissions: Permission[]) => SetMetadata('permissions', permissions);
