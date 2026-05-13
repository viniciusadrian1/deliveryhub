import { z } from 'zod';

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshInput = z.infer<typeof refreshSchema>;
