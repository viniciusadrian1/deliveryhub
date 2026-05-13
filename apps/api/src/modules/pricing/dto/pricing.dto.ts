import { z } from 'zod';

import { PLATFORMS } from '@deliveryhub/shared';

export const listMarginQuerySchema = z.object({
  storeId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
});

export type ListMarginQuery = z.infer<typeof listMarginQuerySchema>;

const strategySameGross = z.object({
  strategy: z.literal('same_gross_pct'),
  deltaPct: z.number().min(-90).max(900),
});

const strategyFixedDelta = z.object({
  strategy: z.literal('fixed_delta_cents'),
  deltaCents: z.number().int(),
});

const strategyKeepMargin = z.object({
  strategy: z.literal('keep_margin_pct'),
  targetMarginPct: z.number().min(0).max(95),
});

const baseBatchSchema = z.object({
  storeId: z.string().uuid(),
  menuItemIds: z.array(z.string().uuid()).min(1).max(500).optional(),
  platformCodes: z.array(z.enum(PLATFORMS)).min(1).optional(),
  minMarginPct: z.number().min(-100).max(99).optional(),
});

export const simulateBatchSchema = baseBatchSchema.and(
  z.union([strategySameGross, strategyFixedDelta, strategyKeepMargin]),
);

export type SimulateBatchInput = z.infer<typeof simulateBatchSchema>;

export const applyBatchSchema = simulateBatchSchema.and(
  z.object({
    skipBelowMinimum: z.boolean().default(false),
  }),
);

export type ApplyBatchInput = z.infer<typeof applyBatchSchema>;
