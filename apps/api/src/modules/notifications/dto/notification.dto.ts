import { z } from 'zod';

export const NOTIFICATION_KINDS = [
  'welcome',
  'invitation_accepted',
  'integration_error',
  'password_changed',
  'new_order',
  'platform_disconnected',
  'payout_mismatch',
  'daily_goal',
  'stock_low',
  'system',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const updatePreferenceSchema = z.object({
  kind: z.enum(NOTIFICATION_KINDS),
  channelInApp: z.boolean().optional(),
  channelEmail: z.boolean().optional(),
});

export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;

export const bulkUpdatePreferencesSchema = z.object({
  preferences: z.array(updatePreferenceSchema).min(1).max(NOTIFICATION_KINDS.length),
});

export type BulkUpdatePreferencesInput = z.infer<typeof bulkUpdatePreferencesSchema>;
