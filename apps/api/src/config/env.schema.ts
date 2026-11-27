import { z } from 'zod';

function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const productionEnvironmentSchema = z.object({
  CORS_ORIGINS: z.string().min(1),
  DATABASE_URL: z
    .string()
    .regex(
      /^postgres(ql)?:\/\//,
      'DATABASE_URL must start with postgres:// or postgresql://',
    ),
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, 'REDIS_URL must start with redis:// or rediss://'),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_REDIRECT_URI: z.string().url(),
  DISCORD_MAIN_GUILD_ID: z.string().regex(/^\d+$/).optional(),
  LASTFM_API_KEY: z.string().min(1),
  LASTFM_REDIRECT_URI: z.string().url(),
  LASTFM_SHARED_SECRET: z.string().min(1),
  MARQUINHOS_API_KEY: z.string().min(16),
  MARQUINHOS_CRYPTO_SALT: z.string().min(16),
  MARQUINHOS_SECRET_KEY: z.string().min(16),
  OPENAI_API_KEY: z.string().min(1),
  SEARXNG_URL: z.string().url().optional(),
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  WORDLE_ACHIEVEMENTS_ENABLED: z.enum(['true', 'false']).optional(),
  WORDLE_TIMEZONE: z
    .string()
    .optional()
    .refine((value) => !value || isValidTimeZone(value), {
      message: 'WORDLE_TIMEZONE must be a valid IANA time zone',
    }),
});

export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;
  productionEnvironmentSchema.parse(process.env);
}
