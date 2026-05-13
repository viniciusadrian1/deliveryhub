import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type CreateModifierGroupInput,
  createModifierGroupSchema,
  type CreateModifierInput,
  createModifierSchema,
  type UpdateModifierGroupInput,
  updateModifierGroupSchema,
  type UpdateModifierInput,
  updateModifierSchema,
} from './dto/modifier.dto.js';
import { ModifiersService } from './modifiers.service.js';

@Controller('menu')
export class ModifiersController {
  constructor(private readonly modifiers: ModifiersService) {}

  // ---- groups ----

  @Get('items/:itemId/modifier-groups')
  listGroups(@CurrentUser() auth: AuthContext, @Param('itemId') itemId: string) {
    return this.modifiers.listGroups(auth, itemId);
  }

  @Post('modifier-groups')
  @Roles('owner', 'manager')
  @HttpCode(201)
  createGroup(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createModifierGroupSchema)) body: CreateModifierGroupInput,
  ) {
    return this.modifiers.createGroup(auth, body);
  }

  @Patch('modifier-groups/:id')
  @Roles('owner', 'manager')
  updateGroup(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateModifierGroupSchema)) body: UpdateModifierGroupInput,
  ) {
    return this.modifiers.updateGroup(auth, id, body);
  }

  @Delete('modifier-groups/:id')
  @Roles('owner', 'manager')
  @HttpCode(204)
  async removeGroup(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.modifiers.removeGroup(auth, id);
  }

  // ---- modifiers ----

  @Post('modifiers')
  @Roles('owner', 'manager')
  @HttpCode(201)
  createModifier(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createModifierSchema)) body: CreateModifierInput,
  ) {
    return this.modifiers.createModifier(auth, body);
  }

  @Patch('modifiers/:id')
  @Roles('owner', 'manager')
  updateModifier(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateModifierSchema)) body: UpdateModifierInput,
  ) {
    return this.modifiers.updateModifier(auth, id, body);
  }

  @Delete('modifiers/:id')
  @Roles('owner', 'manager')
  @HttpCode(204)
  async removeModifier(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.modifiers.removeModifier(auth, id);
  }
}
