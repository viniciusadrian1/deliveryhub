import { z } from 'zod';

import { PLATFORMS } from '@deliveryhub/shared';

export const platformCodeParamSchema = z.object({
  code: z.enum(PLATFORMS),
});

export const upsertPlatformConfigSchema = z.object({
  sellingPriceCents: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  externalId: z.string().min(1).max(128).nullable().optional(),
  externalCategoryId: z.string().min(1).max(128).nullable().optional(),
});

export type UpsertPlatformConfigInput = z.infer<typeof upsertPlatformConfigSchema>;
