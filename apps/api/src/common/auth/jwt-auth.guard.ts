import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TokensService } from '../../modules/auth/tokens.service.js';
import type { AuthContext } from './auth-context.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthContext;
    }>();

    const authHeader = request.headers.authorization;
    const token = this.extractBearer(authHeader);
    if (!token) {
      throw new UnauthorizedException('missing_bearer_token');
    }

    try {
      const payload = await this.tokens.verifyAccessToken(token);
      request.user = {
        userId: payload.sub,
        orgId: payload.orgId,
        role: payload.role as AuthContext['role'],
      };
      return true;
    } catch {
      throw new UnauthorizedException('invalid_access_token');
    }
  }

  private extractBearer(header: string | string[] | undefined): string | null {
    if (typeof header !== 'string') return null;
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
    return value;
  }
}
