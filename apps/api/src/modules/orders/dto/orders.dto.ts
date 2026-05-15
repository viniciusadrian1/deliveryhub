import { z } from 'zod';

const ORDER_STATUSES = [
  'placed',
  'accepted',
  'preparing',
  'ready',
  'dispatched',
  'delivered',
  'cancelled',
] as const;

export const listOrdersQuerySchema = z.object({
  storeId: z.string().uuid(),
  status: z.enum(ORDER_STATUSES).optional(),
  /**
   * Aceita lista separada por vírgula. Útil pro KDS que precisa de
   * múltiplos status simultaneamente (accepted, preparing, ready).
   */
  statusIn: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter((s): s is (typeof ORDER_STATUSES)[number] =>
              (ORDER_STATUSES as readonly string[]).includes(s),
            )
        : undefined,
    ),
  since: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
  /** Quando true, inclui `items` (com modifiers) na resposta — usado pelo KDS. */
  withItems: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const rejectOrderSchema = z.object({
  reason: z.string().min(1).max(200).trim(),
});

export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
