import { z } from 'zod';

export const createModifierGroupSchema = z
  .object({
    menuItemId: z.string().uuid(),
    name: z.string().min(1).max(120).trim(),
    minSelect: z.number().int().min(0).max(50).default(0),
    maxSelect: z.number().int().min(1).max(50).default(1),
    required: z.boolean().default(false),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((d) => d.minSelect <= d.maxSelect, {
    message: 'minSelect must be ≤ maxSelect',
    path: ['minSelect'],
  });

export type CreateModifierGroupInput = z.infer<typeof createModifierGroupSchema>;

export const updateModifierGroupSchema = z
  .object({
    name: z.string().min(1).max(120).trim().optional(),
    minSelect: z.number().int().min(0).max(50).optional(),
    maxSelect: z.number().int().min(1).max(50).optional(),
    required: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine(
    (d) => d.minSelect === undefined || d.maxSelect === undefined || d.minSelect <= d.maxSelect,
    { message: 'minSelect must be ≤ maxSelect', path: ['minSelect'] },
  );

export type UpdateModifierGroupInput = z.infer<typeof updateModifierGroupSchema>;

export const createModifierSchema = z.object({
  modifierGroupId: z.string().uuid(),
  name: z.string().min(1).max(120).trim(),
  costDeltaCents: z.number().int().default(0),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateModifierInput = z.infer<typeof createModifierSchema>;

export const updateModifierSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  costDeltaCents: z.number().int().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type UpdateModifierInput = z.infer<typeof updateModifierSchema>;
