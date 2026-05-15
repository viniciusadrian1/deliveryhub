import { z } from 'zod';

const comboComponentSchema = z.object({
  componentMenuItemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50).default(1),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * Replace-all: cliente envia o array final de componentes do combo.
 * O service substitui em transação e recalcula o CMV.
 */
export const setComboComponentsSchema = z.object({
  components: z.array(comboComponentSchema).min(1).max(20),
});

export type SetComboComponentsInput = z.infer<typeof setComboComponentsSchema>;
