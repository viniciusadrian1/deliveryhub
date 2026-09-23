export type ConnectionStatus = 'pending' | 'active' | 'error' | 'revoked';

export interface PlatformConnection {
  id: string;
  platformCode: string;
  platformName: string;
  storeId: string;
  status: ConnectionStatus;
  externalMerchantId: string | null;
  lastSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
}

/** Área de entrega de uma loja no 99Food (Logistics API). */
export interface DeliveryArea {
  /** IDs 64-bit (string) — usados para excluir a área. */
  areaIds: string[];
  /** 0 = círculo · 1 = polígono. */
  areaType: number;
  radiusKm: number;
  priceCents: number;
  avgDeliveryEtaSeconds: number;
  /** Texto pronto das janelas de horário, ex.: "00:00-23:59". */
  enableTimesLabel: string;
  pointCount: number;
}

export interface StartConnectionResponse {
  connectionId: string;
  platformCode: string;
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresAt: string;
  isMock: boolean;
}

/**
 * Estado de cada plataforma no DeliveryHub:
 *
 * - `available`: adapter implementado, pode conectar agora (real ou mock).
 * - `roadmap`: scaffolding pronto, esperando parceria/credenciais para
 *   ativar (Rappi, Uber Eats, AiQfome).
 * - `unavailable`: plataforma sem operação no Brasil ou sem API pública
 *   para POS (99Food, Keeta) — não dá pra integrar mesmo querendo.
 */
export type PlatformAvailability = 'available' | 'roadmap' | 'unavailable';

export interface PlatformMeta {
  name: string;
  colorHex: string;
  /** Compatibilidade com código antigo — true sse availability === 'available'. */
  enabled: boolean;
  availability: PlatformAvailability;
  logo: string;
  /** Motivo curto exibido em plataformas roadmap/unavailable. */
  reason?: string;
  /**
   * Optional multiplier to enlarge the logo *inside* the fixed tile when the
   * source asset has too much built-in whitespace (e.g. Keeta, 99Food).
   * Defaults to 1.
   */
  logoScale?: number;
}

export const PLATFORM_META: Record<string, PlatformMeta> = {
  ifood: {
    name: 'iFood',
    colorHex: '#EA1D2C',
    enabled: true,
    availability: 'available',
    logo: '/platforms/ifood.png',
  },
  '99food': {
    name: '99Food',
    colorHex: '#FE3324',
    enabled: true,
    availability: 'available',
    logo: '/platforms/99food.png',
  },
  rappi: {
    name: 'Rappi',
    colorHex: '#FF441F',
    enabled: true,
    availability: 'available',
    logo: '/platforms/rappi.png',
  },
  keeta: {
    name: 'Keeta',
    colorHex: '#FFCC00',
    enabled: true,
    availability: 'available',
    logo: '/platforms/keeta.png',
  },
  aiqfome: {
    name: 'AiQfome',
    colorHex: '#7B1FA2',
    enabled: true,
    availability: 'available',
    logo: '/platforms/aiqfome.png',
  },
};
