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

export interface PlatformMeta {
  name: string;
  colorHex: string;
  enabled: boolean;
  logo: string;
}

export const PLATFORM_META: Record<string, PlatformMeta> = {
  ifood:    { name: 'iFood',     colorHex: '#EA1D2C', enabled: true,  logo: '/platforms/ifood.svg' },
  rappi:    { name: 'Rappi',     colorHex: '#FF441F', enabled: false, logo: '/platforms/rappi.png' },
  '99food': { name: '99Food',    colorHex: '#FE3324', enabled: false, logo: '/platforms/99food.svg' },
  keeta:    { name: 'Keeta',     colorHex: '#FFCC00', enabled: false, logo: '/platforms/keeta.png' },
  ubereats: { name: 'Uber Eats', colorHex: '#06C167', enabled: false, logo: '/platforms/ubereats.svg' },
  aiqfome:  { name: 'AiQfome',   colorHex: '#E2231A', enabled: false, logo: '/platforms/aiqfome.png' },
};
