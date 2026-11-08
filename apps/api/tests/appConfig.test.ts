import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'bun:test';
import { AppConfig } from 'config/app.config';
import { createTestAppConfig } from './helpers/testAppConfig';

describe('AppConfig', () => {
  it('prefers an explicit ConfigService value over process.env', () => {
    const config = new AppConfig(
      new ConfigService({ MARQUINHOS_SECRET_KEY: 'explicit' }),
    );
    expect(config.marquinhosSecretKey).toBe('explicit');
  });

  it('reads the process environment when nothing overrides it', () => {
    expect(new AppConfig(new ConfigService()).marquinhosSecretKey).toBe(
      process.env.MARQUINHOS_SECRET_KEY,
    );
  });

  it('applies createTestAppConfig overrides over the environment', () => {
    expect(
      createTestAppConfig({ MARQUINHOS_SECRET_KEY: 'override' })
        .marquinhosSecretKey,
    ).toBe('override');
  });
});
