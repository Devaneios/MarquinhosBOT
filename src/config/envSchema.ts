import { z } from 'zod';

export const envSchema = z.object({
  MARQUINHOS_TOKEN: z.string().min(1),
  MARQUINHOS_API_URL: z.string().url(),
  MARQUINHOS_API_KEY: z.string().min(1),
  MARQUINHOS_CLIENT_ID: z.string().min(1),
  MARQUINHOS_ERROR_WEBHOOK: z.string().url().optional(),
  MARQUINHOS_DECRYPTION_KEY: z.string().optional(),
  MARQUINHOS_WEB_URL: z.string().url().optional(),
  DEEZER_ARL_COOKIE: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  GUILD_MAIN_CHANNEL_ID: z.string().min(1).optional(),
  GUILD_EXTERNAL_ROLE_ID: z.string().min(1).optional(),
  GUILD_NEWCOMERS_CHANNEL_ID: z.string().min(1).optional(),
  MARQUINHOS_SPREADSHEET_ID: z.string().optional(),
  MARQUINHOS_SPREADSHEET_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
