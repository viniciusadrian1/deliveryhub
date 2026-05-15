import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type ResolveActionRequestInput,
  resolveActionRequestSchema,
} from './dto/orders.dto.js';
import { PlatformActionRequestsService } from './platform-action-requests.service.js';

/**
 * Pedidos de ação do cliente (cancelamento / reembolso). A ingestão é via
 * webhook (WebhooksController) — aqui só expomos a resposta da loja.
 */
@Controller('order-requests')
export class PlatformActionRequestsController {
  constructor(private readonly service: PlatformActionRequestsService) {}

  @Post(':id/resolve')
  @Roles('owner', 'manager')
  @HttpCode(200)
  resolve(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resolveActionRequestSchema))
    body: ResolveActionRequestInput,
  ) {
    return this.service.resolve(auth, id, body);
  }
}
