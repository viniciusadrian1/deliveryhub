import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  type BulkUpdatePreferencesInput,
  bulkUpdatePreferencesSchema,
  type ListNotificationsQuery,
  listNotificationsQuerySchema,
} from './dto/notification.dto.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ListNotificationsQuery,
  ) {
    return this.notifications.list(auth, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() auth: AuthContext) {
    return this.notifications.unreadCount(auth).then((count) => ({ count }));
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(@CurrentUser() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.notifications.markRead(auth, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() auth: AuthContext) {
    return this.notifications.markAllRead(auth);
  }

  @Get('preferences')
  listPreferences(@CurrentUser() auth: AuthContext) {
    return this.notifications.listPreferences(auth);
  }

  @Put('preferences')
  @HttpCode(204)
  async updatePreferences(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(bulkUpdatePreferencesSchema)) body: BulkUpdatePreferencesInput,
  ): Promise<void> {
    await this.notifications.updatePreferences(auth, body);
  }
}
