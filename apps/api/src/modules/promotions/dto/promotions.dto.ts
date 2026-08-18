import { z } from 'zod';

import { PLATFORMS } from '@deliveryhub/shared';

export const listPromotionsQuerySchema = z.object({
  storeId: z.string().uuid(),
});
export type ListPromotionsQuery = z.infer<typeof listPromotionsQuerySchema>;

/**
 * Data-only (YYYY-MM-DD), interpretada como meia-noite UTC. Aceitar datetime
 * completo permitiria shift de dia silencioso (ex.: 23h BRT vira o dia
 * seguinte em UTC) — a coluna é DATE e o iFood também só aceita data.
 */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected_YYYY-MM-DD')
  .transform((s) => new Date(`${s}T00:00:00Z`));

export const createPromotionSchema = z
  .object({
    storeId: z.string().uuid(),
    platformCode: z.enum(PLATFORMS),
    name: z.string().min(1).max(120),
    // iFood só aceita percentual e rejeita acima de 70%.
    discountPercent: z.number().int().min(1).max(70),
    startsAt: dateOnly,
    endsAt: dateOnly,
    menuItemIds: z.array(z.string().uuid()).min(1).max(100),
  })
  .refine((v) => v.endsAt >= v.startsAt, {
    message: 'endsAt_before_startsAt',
    path: ['endsAt'],
  });
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
