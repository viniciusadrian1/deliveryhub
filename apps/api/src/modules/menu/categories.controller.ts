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
import { CategoriesService } from './categories.service.js';
import {
  type CreateCategoryInput,
  createCategorySchema,
  type ReorderCategoriesInput,
  reorderCategoriesSchema,
  type UpdateCategoryInput,
  updateCategorySchema,
} from './dto/category.dto.js';

@Controller('menu/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@CurrentUser() auth: AuthContext, @Query('storeId') storeId: string) {
    return this.categories.list(auth, storeId);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(201)
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput,
  ) {
    return this.categories.create(auth, body);
  }

  @Patch(':id')
  @Roles('owner', 'manager')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
  ) {
    return this.categories.update(auth, id, body);
  }

  @Delete(':id')
  @Roles('owner', 'manager')
  @HttpCode(204)
  async remove(@CurrentUser() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.categories.remove(auth, id);
  }

  @Post('reorder')
  @Roles('owner', 'manager')
  @HttpCode(204)
  async reorder(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(reorderCategoriesSchema)) body: ReorderCategoriesInput,
  ): Promise<void> {
    await this.categories.reorder(auth, body.storeId, body.order);
  }
}
