import { config } from 'dotenv';
import { envSchema, type Env } from './envSchema';

config({ quiet: true });

export { envSchema, type Env };

export const env: Env = envSchema.parse(process.env);
