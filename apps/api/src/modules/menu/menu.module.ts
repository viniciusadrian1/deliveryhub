import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { MenuItemsController } from './menu-items.controller.js';
import { MenuItemsService } from './menu-items.service.js';
import { MenuPlatformConfigController } from './menu-platform-config.controller.js';
import { MenuPlatformConfigService } from './menu-platform-config.service.js';
import { MenuSyncController } from './menu-sync.controller.js';
import { MenuSyncService } from './menu-sync.service.js';
import { ModifiersController } from './modifiers.controller.js';
import { ModifiersService } from './modifiers.service.js';

@Module({
  imports: [IntegrationsModule],
  controllers: [
    CategoriesController,
    MenuItemsController,
    MenuPlatformConfigController,
    MenuSyncController,
    ModifiersController,
  ],
  providers: [
    CategoriesService,
    MenuItemsService,
    MenuPlatformConfigService,
    MenuSyncService,
    ModifiersService,
  ],
  exports: [
    CategoriesService,
    MenuItemsService,
    MenuPlatformConfigService,
    MenuSyncService,
    ModifiersService,
  ],
})
export class MenuModule {}
