import { z } from 'zod';

import { PLATFORMS } from '@deliveryhub/shared';

export const startConnectionSchema = z.object({
  platformCode: z.enum(PLATFORMS),
  storeId: z.string().uuid(),
});

export type StartConnectionInput = z.infer<typeof startConnectionSchema>;
