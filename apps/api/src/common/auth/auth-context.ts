import type { Role } from '@deliveryhub/shared';

export interface AuthContext {
  userId: string;
  orgId: string;
  role: Role;
}
