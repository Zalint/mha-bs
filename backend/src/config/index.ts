import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Charge le .env de la racine du mono-repo (depuis backend/src/config → ../../..)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, '../../../.env') });
// Fallback : charge aussi depuis CWD (utile en prod ou quand .env est au CWD).
loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  PUBLIC_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(10),
  PGSSLMODE: z.enum(['disable', 'prefer', 'require']).default('prefer'),

  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire 32 caracteres minimum'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET doit faire 32 caracteres minimum'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  EXTERNAL_API_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),

  BOOTSTRAP_ADMIN_USERNAME: z.string().default('admin'),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().default('admin@mha.sn'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).default('changeMeOnFirstLogin'),
  BOOTSTRAP_ADMIN_FULLNAME: z.string().default('Administrateur MHA'),

  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Bureau de Suivi MHA <noreply@mha.sn>'),
  MAIL_REPLY_TO: z.string().optional(),

  UPLOADS_DIR: z.string().default('./uploads'),
  UPLOADS_MAX_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration invalide :');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const appConfig = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  port: env.PORT,
  publicUrl: env.PUBLIC_URL,
  database: {
    url: env.DATABASE_URL,
    sslMode: env.PGSSLMODE,
  },
  cors: {
    allowedOrigins: env.CORS_ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpires: env.JWT_ACCESS_EXPIRES,
    refreshExpires: env.JWT_REFRESH_EXPIRES,
  },
  externalApi: {
    enabled: env.EXTERNAL_API_ENABLED,
  },
  bootstrap: {
    username: env.BOOTSTRAP_ADMIN_USERNAME,
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    password: env.BOOTSTRAP_ADMIN_PASSWORD,
    fullName: env.BOOTSTRAP_ADMIN_FULLNAME,
  },
  mail: {
    apiKey: env.RESEND_API_KEY,
    from: env.MAIL_FROM,
    replyTo: env.MAIL_REPLY_TO,
  },
  uploads: {
    dir: env.UPLOADS_DIR,
    maxBytes: env.UPLOADS_MAX_BYTES,
  },
  logs: {
    level: env.LOG_LEVEL,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    loginMax: env.RATE_LIMIT_LOGIN_MAX,
  },
} as const;
