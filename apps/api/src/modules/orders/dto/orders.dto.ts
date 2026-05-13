import { z } from 'zod';

export const listOrdersQuerySchema = z.object({
  storeId: z.string().uuid(),
  status: z
    .enum(['placed', 'accepted', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled'])
    .optional(),
  since: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const rejectOrderSchema = z.object({
  reason: z.string().min(1).max(200).trim(),
});

export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
