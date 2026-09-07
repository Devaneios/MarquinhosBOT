import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const productionEnvironmentSchema = z.object({
  CORS_ORIGINS: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_REDIRECT_URI: z.string().url(),
  LASTFM_API_KEY: z.string().min(1),
  LASTFM_REDIRECT_URI: z.string().url(),
  LASTFM_SHARED_SECRET: z.string().min(1),
  MARQUINHOS_API_KEY: z.string().min(1),
  MARQUINHOS_CRYPTO_SALT: z.string().min(1),
  MARQUINHOS_SECRET_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
});

export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;
  productionEnvironmentSchema.parse(process.env);
}
