import { z } from 'zod';

import { ROLES } from '@deliveryhub/shared';

export const createInvitationSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(ROLES),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(120).trim().optional(),
  password: z.string().min(8).max(128).optional(),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
