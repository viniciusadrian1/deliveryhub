const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCents(cents: number): string {
  return BRL.format(cents / 100);
}

export function timeAgo(at: Date | string): string {
  const date = typeof at === 'string' ? new Date(at) : at;
  const diffSec = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return `há ${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  return `há ${h}h ${min % 60}min`;
}

export const PLATFORM_COLORS: Record<string, string> = {
  ifood: '#EA1D2C',
  rappi: '#FF441F',
  '99food': '#FE3324',
  keeta: '#FFCC00',
  ubereats: '#06C167',
  aiqfome: '#E2231A',
};

export const STATUS_LABELS: Record<string, string> = {
  placed: 'Novo',
  accepted: 'Aceito',
  preparing: 'Em preparo',
  ready: 'Pronto',
  dispatched: 'Despachado',
  delivered: 'Concluído',
  cancelled: 'Cancelado',
};
