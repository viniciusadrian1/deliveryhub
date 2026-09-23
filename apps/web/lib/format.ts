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

export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Proteção: se for ciphertext ou token técnico/criptografado, nunca exibir
  if (phone.startsWith('v1:') || phone.includes(':') || phone.length > 25) {
    return null;
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const num1 = digits.slice(4, 9);
    const num2 = digits.slice(9, 13);
    return `(${ddd}) ${num1}-${num2}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const num1 = digits.slice(4, 8);
    const num2 = digits.slice(8, 12);
    return `(${ddd}) ${num1}-${num2}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return phone;
}

export function getWhatsAppUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.startsWith('v1:') || phone.includes(':') || phone.length > 25) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const full = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${full}`;
  }
  return null;
}

/**
 * Extrai e formata o número do pedido visível para operadores e funcionários da cozinha.
 *
 * Exemplos:
 *  - 'sim-keeta-894123' -> '#894123'
 *  - '4829' -> '#4829'
 *  - '0194e82b-8a7e-7c3d-9f45-381c15431f90' -> '#1F90'
 *  - '#1234' -> '#1234'
 */
export function formatOrderNumber(externalId: string | null | undefined): string {
  if (!externalId) return '---';
  const trimmed = externalId.trim();

  if (trimmed.startsWith('#')) return trimmed.replace(/^#+/, '');

  // Formato simulado: sim-<plataforma>-<digitos> (ex: sim-keeta-023957 -> 23957)
  const simMatch = trimmed.match(/^sim-[a-z0-9]+-(\d+)$/i);
  if (simMatch && simMatch[1]) {
    const num = parseInt(simMatch[1], 10);
    return isNaN(num) ? simMatch[1] : String(num);
  }

  // Prefixo com hífen seguido de dígitos: ord-1234, kt-8921
  const hyphenDigitMatch = trimmed.match(/^[a-z0-9]+-(\d+)$/i);
  if (hyphenDigitMatch && hyphenDigitMatch[1]) {
    const num = parseInt(hyphenDigitMatch[1], 10);
    return isNaN(num) ? hyphenDigitMatch[1] : String(num);
  }

  // UUID: extrai os últimos 4 caracteres em maiúsculo
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.slice(-4).toUpperCase();
  }

  // Código curto
  if (trimmed.length <= 8) {
    return trimmed;
  }

  return trimmed.slice(0, 8);
}

