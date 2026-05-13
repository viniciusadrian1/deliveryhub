import { z } from 'zod';

import { ROLES } from '@deliveryhub/shared';

export const createInvitationSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(ROLES),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1),
    name: z.string().min(1).max(120).trim().optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine(
    (data) => (data.password === undefined) === (data.name === undefined),
    {
      message: 'name and password must be provided together when accepting as a new user',
      path: ['password'],
    },
  );

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
