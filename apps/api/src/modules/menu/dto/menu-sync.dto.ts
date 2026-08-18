import { z } from 'zod';

import { PLATFORMS } from '@deliveryhub/shared';

export const initialSyncSchema = z.object({
  storeId: z.string().uuid(),
  platformCode: z.enum(PLATFORMS),
});

export type InitialSyncInput = z.infer<typeof initialSyncSchema>;

/** Publicação completa do cardápio local na plataforma (mesmo shape). */
export const publishAllSchema = initialSyncSchema;

export type PublishAllInput = z.infer<typeof publishAllSchema>;
