import type { PlatformCode } from '@deliveryhub/shared';

export interface ConnectResult {
  externalMerchantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface PlatformAdapter {
  readonly code: PlatformCode;

  connect(authCode: string, redirectUri: string): Promise<ConnectResult>;
  refreshAuth(refreshToken: string): Promise<ConnectResult>;

  pushItemAvailability(
    connectionId: string,
    externalId: string,
    available: boolean,
  ): Promise<void>;

  pushStorePause(
    connectionId: string,
    paused: boolean,
    until?: Date,
    reason?: string,
  ): Promise<void>;

  acceptOrder(connectionId: string, externalOrderId: string): Promise<void>;
  rejectOrder(connectionId: string, externalOrderId: string, reason: string): Promise<void>;
  dispatchOrder(connectionId: string, externalOrderId: string): Promise<void>;

  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer): boolean;
}
