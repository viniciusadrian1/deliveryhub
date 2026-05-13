import { Module } from '@nestjs/common';

import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { MenuItemsController } from './menu-items.controller.js';
import { MenuItemsService } from './menu-items.service.js';
import { ModifiersController } from './modifiers.controller.js';
import { ModifiersService } from './modifiers.service.js';

@Module({
  controllers: [CategoriesController, MenuItemsController, ModifiersController],
  providers: [CategoriesService, MenuItemsService, ModifiersService],
  exports: [CategoriesService, MenuItemsService, ModifiersService],
})
export class MenuModule {}
