import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MODE: z.enum(['api', 'worker']).default('api'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  API_PORT: z.coerce.number().int().positive().default(3333),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),

  VAULT_MASTER_KEY: z.string().min(32),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('DeliveryHub <no-reply@deliveryhub.local>'),
  WEB_BASE_URL: z.string().url().default('http://localhost:3001'),

  IFOOD_CLIENT_ID: z.string().optional(),
  IFOOD_CLIENT_SECRET: z.string().optional(),
  IFOOD_API_BASE_URL: z.string().url().default('https://merchant-api.ifood.com.br'),
  IFOOD_WEBHOOK_SECRET: z.string().optional(),

  // Rappi Partners (requer parceria comercial)
  RAPPI_CLIENT_ID: z.string().optional(),
  RAPPI_CLIENT_SECRET: z.string().optional(),
  RAPPI_API_BASE_URL: z.string().url().default('https://services.rappi.com'),
  RAPPI_WEBHOOK_SECRET: z.string().optional(),

  // Uber Eats Marketplace (requer parceria comercial)
  UBEREATS_CLIENT_ID: z.string().optional(),
  UBEREATS_CLIENT_SECRET: z.string().optional(),
  UBEREATS_API_BASE_URL: z.string().url().default('https://api.uber.com'),
  UBEREATS_WEBHOOK_SECRET: z.string().optional(),
  UBEREATS_REDIRECT_URI: z.string().url().default('http://localhost:3000/integrations/ubereats/callback'),

  // AiQfome / Magalu Marketplace (API Key, sob NDA)
  AIQFOME_API_KEY: z.string().optional(),
  AIQFOME_API_BASE_URL: z.string().url().default('https://api.aiqfome.com'),
  AIQFOME_WEBHOOK_SECRET: z.string().optional(),

  // 99Food / DiDi Food Open Platform (developer-food.99app.com)
  DIDIFOOD_CLIENT_ID: z.string().optional(),
  DIDIFOOD_CLIENT_SECRET: z.string().optional(),
  DIDIFOOD_API_BASE_URL: z.string().url().default('https://openapi.99food.com'),
  DIDIFOOD_WEBHOOK_SECRET: z.string().optional(),

  // Keeta (Meituan Overseas) — developers.mykeeta.com
  KEETA_CLIENT_ID: z.string().optional(),
  KEETA_CLIENT_SECRET: z.string().optional(),
  KEETA_API_BASE_URL: z.string().url().default('https://openapi.mykeeta.com'),
  KEETA_WEBHOOK_SECRET: z.string().optional(),

  // ===== Object Storage (R2 / S3 / Supabase-storage compatible) =====
  // Quando todos preenchidos, uploads vão pro bucket. Quando vazios, o
  // endpoint de upload responde 503 com mensagem clara.
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  /**
   * URL base pública do bucket — ex.: https://media.seudominio.com.br
   * ou https://pub-<id>.r2.dev. Concatenamos com a key para gerar a URL
   * final no MenuItem.imageUrl.
   */
  STORAGE_PUBLIC_URL: z.string().url().optional(),

  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('local'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}
