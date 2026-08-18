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

/** Ordem linear do fluxo do pedido. `cancelled` empata com `delivered` (ambos finais). */
const RANK: Record<OrderStatus, number> = {
  placed: 0,
  accepted: 1,
  preparing: 2,
  ready: 3,
  dispatched: 4,
  delivered: 5,
  cancelled: 5,
};

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
  // A plataforma e autoritativa sobre a conclusao: um 'delivered' vindo dela sobrepoe
  // um cancelamento LOCAL que a plataforma nao honrou (ex.: cancelar apos o despacho no
  // iFood -> requestCancellation negado -> o pedido conclui do lado da plataforma).
  if (from === 'cancelled' && to === 'delivered') return to;
  // Estados terminais nao retrocedem.
  if (TERMINAL_STATUSES.has(from)) return from;
  // A plataforma nunca retrocede um pedido em andamento. Eventos que nao carregam status
  // (ex.: grupo DELIVERY do iFood) caem em 'placed' e regrediriam o pedido — bloqueia.
  if (RANK[to] < RANK[from]) return from;
  // Saltos para frente sao ok (cobre reordenamentos / iFood pulando 'preparing').
  return to;
}
