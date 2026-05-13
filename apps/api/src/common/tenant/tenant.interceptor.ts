import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';

import type { AuthContext } from '../auth/auth-context.js';
import { TenantContextService } from './tenant-context.service.js';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: AuthContext }>();
    const auth = request.user;

    if (!auth) {
      return next.handle();
    }

    return this.tenantContext.run(auth, () => next.handle());
  }
}
