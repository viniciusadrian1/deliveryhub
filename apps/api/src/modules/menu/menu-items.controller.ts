import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type CreateMenuItemInput,
  createMenuItemSchema,
  type ListMenuItemsQuery,
  listMenuItemsQuerySchema,
  type UpdateMenuItemInput,
  updateMenuItemSchema,
} from './dto/menu-item.dto.js';
import { MenuItemsService } from './menu-items.service.js';

@Controller('menu/items')
export class MenuItemsController {
  constructor(private readonly items: MenuItemsService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listMenuItemsQuerySchema)) query: ListMenuItemsQuery,
  ) {
    return this.items.list(auth, query);
  }

  @Get(':id')
  findOne(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.items.findOne(auth, id);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(201)
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createMenuItemSchema)) body: CreateMenuItemInput,
  ) {
    return this.items.create(auth, body);
  }

  @Patch(':id')
  @Roles('owner', 'manager')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMenuItemSchema)) body: UpdateMenuItemInput,
  ) {
    return this.items.update(auth, id, body);
  }

  @Post(':id/archive')
  @Roles('owner', 'manager')
  archive(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.items.archive(auth, id);
  }

  @Post(':id/unarchive')
  @Roles('owner', 'manager')
  unarchive(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.items.unarchive(auth, id);
  }

  @Delete(':id')
  @Roles('owner', 'manager')
  @HttpCode(204)
  async remove(@CurrentUser() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.items.remove(auth, id);
  }
}
