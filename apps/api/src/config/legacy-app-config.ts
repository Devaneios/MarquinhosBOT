import type { ConfigService } from '@nestjs/config';
import { AppConfig } from 'config/app.config';

/** Temporary bridge for Express middleware and routers awaiting Nest migration. */
export function createLegacyAppConfig(): AppConfig {
  return new AppConfig({
    get: (key: string) => process.env[key],
  } as ConfigService);
}
