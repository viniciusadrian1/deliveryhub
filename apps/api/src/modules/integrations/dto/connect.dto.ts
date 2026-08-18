import { z } from 'zod';

import { PLATFORMS } from '@deliveryhub/shared';

export const startConnectionSchema = z.object({
  platformCode: z.enum(PLATFORMS),
  storeId: z.string().uuid(),
});

export type StartConnectionInput = z.infer<typeof startConnectionSchema>;

/**
 * Body do finalize. `authorizationCode` é o código que o iFood devolve ao
 * usuário após autorizar no portal (device flow). Opcional: 99Food/Keeta
 * não usam. `.default({})` tolera body vazio dessas plataformas.
 */
export const finalizeConnectionSchema = z
  .object({
    authorizationCode: z.string().trim().min(1).optional(),
  })
  .default({});

export type FinalizeConnectionInput = z.infer<typeof finalizeConnectionSchema>;
