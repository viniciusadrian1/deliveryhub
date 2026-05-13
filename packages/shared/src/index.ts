export const APP_NAME = 'DeliveryHub';

export const PLATFORMS = ['ifood', 'rappi', '99food', 'keeta', 'ubereats', 'aiqfome'] as const;
export type PlatformCode = (typeof PLATFORMS)[number];

export const ROLES = ['owner', 'manager', 'staff', 'financial'] as const;
export type Role = (typeof ROLES)[number];
