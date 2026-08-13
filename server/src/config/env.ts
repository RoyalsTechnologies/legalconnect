import 'dotenv/config';
import { z } from 'zod';

// Validated once at startup so a misconfigured deployment fails immediately and
// loudly rather than at the first request that happens to need a variable.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),

  // AI configuration is optional. A missing key is a normal, supported state: the
  // triage service treats it as an unavailable provider and takes the documented
  // fallback path (FR-010), so the intake workflow still works without it.
  AI_PROVIDER_API_KEY: z.string().optional(),
  AI_PROVIDER_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  AI_PROVIDER_MODEL: z.string().default('gpt-4o-mini'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // Email is optional. Without EMAIL_HOST, the mailer logs instead of sending —
  // useful for local work and for tests. Transactional flows still create tokens.
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().int().positive().default(465),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default('LegalConnect Ghana'),
  EMAIL_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  // SMS is optional (Nalo / SMS Solutions HTTP API). Without a full set the
  // client logs instead of sending — same pattern as email.
  SMS_ENDPOINT: z
    .string()
    .transform((value) => value.replace(/\?+$/, ''))
    .pipe(z.string().url())
    .optional(),
  SMS_SENDER_ID: z.string().min(1).optional(),
  SMS_USERNAME: z.string().min(1).optional(),
  SMS_PASSWORD: z.string().min(1).optional(),

  // NaloPay is optional. Without a full credential set, development and tests
  // record the payment locally (same pattern as email). Production refuses to
  // mark paid. Secrets stay server-side — never send them to the client.
  NALOPAY_MERCHANT_ID: z.string().min(1).optional(),
  NALOPAY_BASIC_AUTH: z.string().min(1).optional(),
  NALOPAY_MERCHANT_SECRET_KEY: z.string().min(1).optional(),
  NALOPAY_BASE_URL: z.string().url().optional(),
  NALOPAY_CALLBACK_URL: z.string().url().optional(),
});

// A variable left blank in .env arrives as "". Treat that as absent so optional
// values fall back to their defaults instead of being read as a real setting —
// an empty AI_PROVIDER_API_KEY must not look like a configured key.
const rawEnv = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
// Vitest loads `.env` (NODE_ENV=development) before setup.ts overrides it.
// Honour VITEST so payment tests never call the live gateway.
export const isTest = env.NODE_ENV === 'test' || process.env.VITEST === 'true';

/** True when SMTP is configured enough to attempt a real send. */
export const isEmailConfigured = Boolean(
  env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASSWORD && env.EMAIL_FROM,
);

/** True when the SMS gateway credentials are complete enough to attempt a send. */
export const isSmsConfigured = Boolean(
  env.SMS_ENDPOINT && env.SMS_SENDER_ID && env.SMS_USERNAME && env.SMS_PASSWORD,
);

/** True when NaloPay can take a live (or test-mode) mobile-money collection. */
export const isNaloPayConfigured = Boolean(
  env.NALOPAY_MERCHANT_ID &&
    env.NALOPAY_BASIC_AUTH &&
    env.NALOPAY_MERCHANT_SECRET_KEY &&
    env.NALOPAY_BASE_URL,
);
