import { describe, expect, test } from 'bun:test';
import { envSchema } from '@marquinhos/config/envSchema';

describe('env schema', () => {
  test('parses valid environment', () => {
    const result = envSchema.parse({
      MARQUINHOS_TOKEN: 'token',
      MARQUINHOS_API_URL: 'https://example.com',
      MARQUINHOS_API_KEY: 'key',
      MARQUINHOS_CLIENT_ID: 'client-id',
    });
    expect(result.NODE_ENV).toBe('production');
    expect(result.MARQUINHOS_TOKEN).toBe('token');
  });

  test('throws on missing required field', () => {
    expect(() =>
      envSchema.parse({
        MARQUINHOS_API_URL: 'https://example.com',
        MARQUINHOS_API_KEY: 'key',
        MARQUINHOS_CLIENT_ID: 'client-id',
      }),
    ).toThrow();
  });

  test('throws on invalid API URL', () => {
    expect(() =>
      envSchema.parse({
        MARQUINHOS_TOKEN: 'token',
        MARQUINHOS_API_URL: 'not-a-url',
        MARQUINHOS_API_KEY: 'key',
        MARQUINHOS_CLIENT_ID: 'client-id',
      }),
    ).toThrow();
  });

  test('defaults NODE_ENV to production', () => {
    const result = envSchema.parse({
      MARQUINHOS_TOKEN: 'token',
      MARQUINHOS_API_URL: 'https://example.com',
      MARQUINHOS_API_KEY: 'key',
      MARQUINHOS_CLIENT_ID: 'client-id',
    });
    expect(result.NODE_ENV).toBe('production');
  });

  test('accepts optional GUILD_* fields', () => {
    const result = envSchema.parse({
      MARQUINHOS_TOKEN: 'token',
      MARQUINHOS_API_URL: 'https://example.com',
      MARQUINHOS_API_KEY: 'key',
      MARQUINHOS_CLIENT_ID: 'client-id',
      GUILD_MAIN_CHANNEL_ID: '123',
      GUILD_EXTERNAL_ROLE_ID: '456',
      GUILD_NEWCOMERS_CHANNEL_ID: '789',
    });
    expect(result.GUILD_MAIN_CHANNEL_ID).toBe('123');
    expect(result.GUILD_EXTERNAL_ROLE_ID).toBe('456');
    expect(result.GUILD_NEWCOMERS_CHANNEL_ID).toBe('789');
  });
});
