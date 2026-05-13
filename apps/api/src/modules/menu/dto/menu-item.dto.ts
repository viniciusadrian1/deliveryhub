import { z } from 'zod';

const allergensSchema = z
  .array(z.string().min(1).max(40).trim())
  .max(20)
  .transform((list) => Array.from(new Set(list.map((a) => a.toLowerCase()))));

export const createMenuItemSchema = z.object({
  storeId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(160).trim(),
  description: z.string().max(800).trim().optional(),
  imageUrl: z.string().url().optional(),
  prepTimeMinutes: z.number().int().min(0).max(600).optional(),
  costCents: z.number().int().min(0).default(0),
  allergens: allergensSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

export const updateMenuItemSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(160).trim().optional(),
  description: z.string().max(800).trim().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  prepTimeMinutes: z.number().int().min(0).max(600).nullable().optional(),
  costCents: z.number().int().min(0).optional(),
  allergens: allergensSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

export const listMenuItemsQuerySchema = z.object({
  storeId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  archived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type ListMenuItemsQuery = z.infer<typeof listMenuItemsQuerySchema>;
