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
    logo: '/platforms/ifood.svg',
  },
  rappi: {
    name: 'Rappi',
    colorHex: '#FF441F',
    enabled: false,
    availability: 'roadmap',
    reason: 'Aguardando aprovação no programa Rappi Partners.',
    logo: '/platforms/rappi.png',
  },
  ubereats: {
    name: 'Uber Eats',
    colorHex: '#06C167',
    enabled: false,
    availability: 'roadmap',
    reason: 'Aguardando onboarding no Uber Eats Marketplace.',
    logo: '/platforms/ubereats.png',
    logoScale: 2.1,
  },
  aiqfome: {
    name: 'AiQfome',
    colorHex: '#E2231A',
    enabled: false,
    availability: 'roadmap',
    reason: 'Aguardando aprovação no Magalu Marketplace (NDA).',
    logo: '/platforms/aiqfome.png',
    logoScale: 1.4,
  },
  '99food': {
    name: '99Food',
    colorHex: '#FE3324',
    enabled: true,
    availability: 'available',
    logo: '/platforms/99food.svg',
    logoScale: 2.2,
  },
  keeta: {
    name: 'Keeta',
    colorHex: '#FFCC00',
    enabled: false,
    availability: 'roadmap',
    reason: 'Cadastre-se no portal Keeta (developers.mykeeta.com).',
    logo: '/platforms/keeta.png',
    logoScale: 3.5,
  },
};
