import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';

import type { PlatformCode } from '@deliveryhub/shared';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type InitialSyncInput,
  initialSyncSchema,
  type PublishAllInput,
  publishAllSchema,
} from './dto/menu-sync.dto.js';
import { MenuSyncService } from './menu-sync.service.js';

@Controller()
export class MenuSyncController {
  constructor(private readonly sync: MenuSyncService) {}

  @Post('menu/sync/initial')
  @Roles('owner', 'manager')
  @HttpCode(200)
  initialSync(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(initialSyncSchema)) body: InitialSyncInput,
  ) {
    return this.sync.pullInitial(auth, body.storeId, body.platformCode);
  }

  @Post('menu/items/:id/platforms/:platformCode/sync-price')
  @Roles('owner', 'manager')
  @HttpCode(200)
  syncPrice(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Param('platformCode') platformCode: PlatformCode,
  ) {
    return this.sync.pushItemPrice(auth, id, platformCode);
  }

  @Post('menu/items/:id/platforms/:platformCode/sync-availability')
  @Roles('owner', 'manager')
  @HttpCode(200)
  syncAvailability(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Param('platformCode') platformCode: PlatformCode,
  ) {
    return this.sync.pushItemAvailability(auth, id, platformCode);
  }

  /** Publica o item completo (produto + complementos + foto) na plataforma. */
  @Post('menu/items/:id/platforms/:platformCode/publish')
  @Roles('owner', 'manager')
  @HttpCode(200)
  publishItem(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Param('platformCode') platformCode: PlatformCode,
  ) {
    return this.sync.publishItem(auth, id, platformCode);
  }

  /** Publica o cardápio inteiro da loja na plataforma. */
  @Post('menu/sync/publish-all')
  @Roles('owner', 'manager')
  @HttpCode(200)
  publishAll(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(publishAllSchema)) body: PublishAllInput,
  ) {
    return this.sync.publishAll(auth, body.storeId, body.platformCode);
  }
}
