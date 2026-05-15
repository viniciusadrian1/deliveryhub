import { Body, Controller, Get, Param, Put } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { CombosService } from './combos.service.js';
import {
  setComboComponentsSchema,
  type SetComboComponentsInput,
} from './dto/combo.dto.js';

@Controller('menu/combos')
export class CombosController {
  constructor(private readonly combos: CombosService) {}

  @Get(':menuItemId')
  get(@CurrentUser() auth: AuthContext, @Param('menuItemId') menuItemId: string) {
    return this.combos.getCombo(auth, menuItemId);
  }

  @Put(':menuItemId/components')
  @Roles('owner', 'manager')
  setComponents(
    @CurrentUser() auth: AuthContext,
    @Param('menuItemId') menuItemId: string,
    @Body(new ZodValidationPipe(setComboComponentsSchema))
    body: SetComboComponentsInput,
  ) {
    return this.combos.setComponents(auth, menuItemId, body);
  }
}
