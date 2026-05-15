export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'online' | 'cash' | 'other';
export type DeliveryBy = 'platform' | 'store';

export type ActionRequestKind = 'cancellation' | 'refund';
export type ActionRequestStatus = 'pending' | 'approved' | 'declined';

export interface ActionReasonOption {
  /** Só o reembolso traz id (base_reason_id); cancelamento traz só o texto. */
  id?: string;
  label: string;
}

/** Resumo leve de pedido de ação — usado no card do Hub. */
export interface ActionRequestSummary {
  id: string;
  kind: ActionRequestKind;
}

/** Pedido de cancelamento/reembolso aberto pelo cliente na plataforma. */
export interface OrderActionRequest {
  id: string;
  kind: ActionRequestKind;
  status: ActionRequestStatus;
  customerReason: string | null;
  reasonOptions: ActionReasonOption[] | null;
  evidenceImages: string[] | null;
  resolvedReason: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface OrderListItem {
  id: string;
  externalId: string;
  status: OrderStatus;
  totalCents: number;
  netCents: number;
  platformFeeCents: number;
  placedAt: string;
  notes: string | null;
  platform: { code: string; name: string; colorHex: string };
  customer: { id: string; name: string } | null;
  /** Pedidos de cancelamento/reembolso pendentes (selo no card). */
  actionRequests: ActionRequestSummary[];
}

export interface OrderItemDetail {
  id: string;
  nameSnapshot: string;
  qty: number;
  unitPriceCents: number;
  totalCents: number;
  notes: string | null;
  modifiers: Array<{
    id: string;
    nameSnapshot: string;
    qty: number;
    unitPriceCents: number;
  }>;
}

export interface OrderDetail extends OrderListItem {
  subtotalCents: number;
  deliveryFeeCents: number;
  processingFeeCents: number;
  flatFeeCents: number;
  cancellationReason: string | null;
  paymentMethod: PaymentMethod | null;
  deliveryBy: DeliveryBy | null;
  cashPaymentConfirmedAt: string | null;
  acceptedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  customer: { id: string; name: string; phone: string | null } | null;
  items: OrderItemDetail[];
  statusEvents: Array<{
    id: string;
    status: OrderStatus;
    source: string;
    at: string;
  }>;
  /** Pedidos de ação completos (banner no drawer). */
  actionRequests: OrderActionRequest[];
}

export interface OrderEventPayload {
  event: 'order.created' | 'order.updated';
  organizationId: string;
  storeId: string;
  orderId: string;
  status: OrderStatus;
  externalId: string;
  platformCode: string;
  totalCents: number;
  netCents: number;
  placedAt: string;
}
