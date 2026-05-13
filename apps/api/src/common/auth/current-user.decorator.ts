import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthContext } from './auth-context.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthContext }>();
    return request.user;
  },
);
