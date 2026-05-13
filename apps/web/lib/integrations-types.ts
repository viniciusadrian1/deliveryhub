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

export const PLATFORM_META: Record<
  string,
  { name: string; colorHex: string; enabled: boolean }
> = {
  ifood: { name: 'iFood', colorHex: '#EA1D2C', enabled: true },
  rappi: { name: 'Rappi', colorHex: '#FF441F', enabled: false },
  '99food': { name: '99Food', colorHex: '#FE3324', enabled: false },
  keeta: { name: 'Keeta', colorHex: '#FFCC00', enabled: false },
  ubereats: { name: 'Uber Eats', colorHex: '#06C167', enabled: false },
  aiqfome: { name: 'AiQfome', colorHex: '#E2231A', enabled: false },
};
