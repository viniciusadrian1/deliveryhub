import { z } from 'zod';

export const createCategorySchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(500).trim().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  description: z.string().max(500).trim().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const reorderCategoriesSchema = z.object({
  storeId: z.string().uuid(),
  order: z.array(z.string().uuid()).min(1),
});

export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
