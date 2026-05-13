export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

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
