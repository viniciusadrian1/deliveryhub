import { SetMetadata } from '@nestjs/common';

import type { Role } from '@deliveryhub/shared';

export const ROLES_KEY = 'requiredRoles';

export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
