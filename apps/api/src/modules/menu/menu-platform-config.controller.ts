import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
} from '@nestjs/common';

import type { PlatformCode } from '@deliveryhub/shared';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type UpsertPlatformConfigInput,
  upsertPlatformConfigSchema,
} from './dto/menu-platform-config.dto.js';
import { MenuPlatformConfigService } from './menu-platform-config.service.js';

@Controller('menu/items')
export class MenuPlatformConfigController {
  constructor(private readonly configs: MenuPlatformConfigService) {}

  @Get(':id/platforms')
  list(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.configs.listForItem(auth, id);
  }

  @Put(':id/platforms/:platformCode')
  @Roles('owner', 'manager')
  upsert(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Param('platformCode') platformCode: PlatformCode,
    @Body(new ZodValidationPipe(upsertPlatformConfigSchema)) body: UpsertPlatformConfigInput,
  ) {
    return this.configs.upsert(auth, id, platformCode, body);
  }

  @Delete(':id/platforms/:platformCode')
  @Roles('owner', 'manager')
  @HttpCode(204)
  async remove(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Param('platformCode') platformCode: PlatformCode,
  ): Promise<void> {
    await this.configs.remove(auth, id, platformCode);
  }
}
