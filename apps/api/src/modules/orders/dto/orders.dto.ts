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

/**
 * Resposta a um pedido de cancelamento/reembolso do cliente
 * (PlatformActionRequest). `baseReasonId`/`baseReason` são obrigatórios
 * ao RECUSAR um reembolso — escolhidos da lista enviada pela plataforma.
 */
export const resolveActionRequestSchema = z.object({
  approve: z.boolean(),
  reason: z.string().max(300).trim().optional(),
  baseReasonId: z.string().min(1).max(50).optional(),
  baseReason: z.string().min(1).max(300).trim().optional(),
});

export type ResolveActionRequestInput = z.infer<typeof resolveActionRequestSchema>;

/**
 * Despacho de pedido de ENTREGA PRÓPRIA do 99Food — dados do entregador
 * da loja, enviados à plataforma via Self Delivery.
 */
export const dispatchSelfDeliverySchema = z.object({
  courierName: z.string().min(1).max(120).trim(),
  courierPhone: z.string().min(1).max(40).trim(),
  courierPhoneCode: z.string().min(1).max(8).trim().default('+55'),
  /** 100 a pé · 101 e-bike · 102 moto · 103 bike · 104 carro · 105 moto 125cc. */
  vehicleType: z.coerce.number().int().min(100).max(105).optional(),
  /** Minutos estimados até a entrega, a partir de agora. */
  etaMinutes: z.coerce.number().int().min(5).max(180).default(40),
});

export type DispatchSelfDeliveryInput = z.infer<typeof dispatchSelfDeliverySchema>;
