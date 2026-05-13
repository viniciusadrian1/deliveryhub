import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';

import { captureException } from './sentry.js';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap({
        error: (err: unknown) => {
          const status = err instanceof HttpException ? err.getStatus() : 500;
          // 5xx ou erros não-HTTP (bugs) → Sentry. Clientes 4xx não viram noise.
          if (status >= 500) {
            const request = context.switchToHttp().getRequest<{
              method?: string;
              url?: string;
            }>();
            captureException(err, { method: request.method, url: request.url });
          }
        },
      }),
    );
  }
}
