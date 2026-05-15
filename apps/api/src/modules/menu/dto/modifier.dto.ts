import { z } from 'zod';

const MODIFIER_GROUP_KINDS = [
  'ingredients',
  'specifications',
  'cross_sell',
  'disposables',
] as const;

export const createModifierGroupSchema = z
  .object({
    menuItemId: z.string().uuid(),
    /** Categoria do grupo: define o papel na UI do cliente final. */
    kind: z.enum(MODIFIER_GROUP_KINDS).default('ingredients'),
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
    kind: z.enum(MODIFIER_GROUP_KINDS).optional(),
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
  description: z.string().max(400).trim().optional(),
  imageUrl: z.string().url().optional(),
  costDeltaCents: z.number().int().default(0),
  /**
   * Quando preenchido, este modifier "reusa" um MenuItem existente
   * (estilo "Copiar complemento" do iFood). O backend pode usar a
   * receita do item original pra dar baixa de estoque.
   */
  linkedMenuItemId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateModifierInput = z.infer<typeof createModifierSchema>;

export const updateModifierSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  description: z.string().max(400).trim().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  costDeltaCents: z.number().int().optional(),
  linkedMenuItemId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type UpdateModifierInput = z.infer<typeof updateModifierSchema>;
