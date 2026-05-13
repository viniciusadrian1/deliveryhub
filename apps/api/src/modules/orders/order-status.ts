export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['dispatched', 'cancelled'],
  dispatched: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set(['delivered', 'cancelled']);

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`invalid_transition:${from}->${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Aplica uma transição idempotente: se `to === from`, retorna `from` sem erro
 * (útil quando webhook chega duplicado). Caso contrário, valida e retorna `to`.
 */
export function transition(from: OrderStatus, to: OrderStatus): OrderStatus {
  if (from === to) return from;
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  return to;
}

/**
 * Permite avanços vindos da plataforma mesmo quando não estão no caminho
 * direto (ex.: iFood pula "preparing" e manda direto "dispatched"). Aceita
 * qualquer avanço para frente; rejeita só retrocessos de terminais.
 */
export function reconcileFromPlatform(from: OrderStatus, to: OrderStatus): OrderStatus {
  if (from === to) return from;
  if (TERMINAL_STATUSES.has(from)) return from;
  // Permite saltos para frente (cobre reordenamentos do iFood).
  return to;
}
