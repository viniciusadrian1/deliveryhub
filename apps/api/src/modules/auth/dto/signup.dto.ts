import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).trim(),
  organizationName: z.string().min(1).max(160).trim(),
});

export type SignupInput = z.infer<typeof signupSchema>;
