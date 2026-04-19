import { config } from 'dotenv';
import { envSchema, type Env } from './envSchema';

config();

export { envSchema, type Env };

export const env: Env = envSchema.parse(process.env);
