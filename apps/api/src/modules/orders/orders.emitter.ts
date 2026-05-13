import { Injectable } from '@nestjs/common';

export type OrderEventName = 'order.created' | 'order.updated';

export interface OrderEventPayload {
  event: OrderEventName;
  organizationId: string;
  storeId: string;
  orderId: string;
  status: string;
  externalId: string;
  platformCode: string;
  totalCents: number;
  netCents: number;
  placedAt: Date;
}

@Injectable()
export class OrdersEmitter {
  private readonly listeners: Array<(p: OrderEventPayload) => void> = [];

  emit(payload: OrderEventPayload): void {
    for (const fn of this.listeners) {
      try {
        fn(payload);
      } catch {
        // emit não pode quebrar fluxo principal
      }
    }
  }

  subscribe(fn: (p: OrderEventPayload) => void): () => void {
    this.listeners.push(fn);
    return () => {
      const idx = this.listeners.indexOf(fn);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }
}
