import type { ConfigService } from '@nestjs/config';
import { AppConfig } from 'config/app.config';

export function createTestAppConfig(
  overrides: Record<string, string | undefined> = {},
): AppConfig {
  const values = { ...process.env, ...overrides };
  return new AppConfig({
    get: (key: string) => values[key],
  } as ConfigService);
}
