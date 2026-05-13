import { z } from 'zod';

import { PLATFORMS } from '@deliveryhub/shared';

const PAUSE_REASONS = [
  'kitchen_overloaded',
  'end_of_shift',
  'out_of_stock',
  'scheduled',
  'other',
] as const;

export const createPauseSchema = z
  .object({
    storeId: z.string().uuid(),
    scope: z.enum(['store', 'category', 'item']),
    categoryId: z.string().uuid().optional(),
    menuItemId: z.string().uuid().optional(),
    platformCodes: z.array(z.enum(PLATFORMS)).optional(),
    /** Duração relativa em minutos. */
    durationMinutes: z.number().int().min(1).max(60 * 24).optional(),
    /** Alternativa a `durationMinutes` — hora absoluta. */
    endsAt: z.coerce.date().optional(),
    reason: z.enum(PAUSE_REASONS).default('other'),
    reasonNote: z.string().max(280).optional(),
  })
  .refine((d) => d.scope !== 'category' || !!d.categoryId, {
    message: 'categoryId is required when scope=category',
    path: ['categoryId'],
  })
  .refine((d) => d.scope !== 'item' || !!d.menuItemId, {
    message: 'menuItemId is required when scope=item',
    path: ['menuItemId'],
  })
  .refine((d) => !(d.durationMinutes && d.endsAt), {
    message: 'use durationMinutes OR endsAt, not both',
    path: ['endsAt'],
  });

export type CreatePauseInput = z.infer<typeof createPauseSchema>;

export const listPausesQuerySchema = z.object({
  storeId: z.string().uuid(),
  status: z.enum(['active', 'history']).default('active'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

export type ListPausesQuery = z.infer<typeof listPausesQuerySchema>;
