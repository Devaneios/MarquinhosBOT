import { isDevelopmentChannelAllowed } from '@marquinhos/config/developmentScope';
import { describe, expect, test } from 'bun:test';

describe('development bot channel scope', () => {
  test('fails closed without development configuration and leaves production unrestricted', () => {
    const context = { guildId: 'guild', channelId: 'general' };
    expect(
      isDevelopmentChannelAllowed(context, { NODE_ENV: 'development' }),
    ).toBe(false);
    expect(
      isDevelopmentChannelAllowed(context, { NODE_ENV: 'production' }),
    ).toBe(true);
  });

  const config = {
    NODE_ENV: 'development' as const,
    DEV_TEST_CHANNEL_ID: 'test-channel',
  };

  test('accepts the test channel and its threads, but not other channels or DMs', () => {
    expect(
      isDevelopmentChannelAllowed(
        { guildId: 'guild', channelId: 'test-channel' },
        config,
      ),
    ).toBe(true);
    expect(
      isDevelopmentChannelAllowed(
        {
          guildId: 'guild',
          channelId: 'thread',
          channel: { isThread: () => true, parentId: 'test-channel' },
        },
        config,
      ),
    ).toBe(true);
    expect(
      isDevelopmentChannelAllowed(
        { guildId: 'guild', channelId: 'general' },
        config,
      ),
    ).toBe(false);
    expect(
      isDevelopmentChannelAllowed(
        { guildId: null, channelId: 'test-channel' },
        config,
      ),
    ).toBe(false);
    expect(
      isDevelopmentChannelAllowed(
        {
          guildId: 'guild',
          channelId: 'other',
          channel: { isThread: () => false, parentId: 'test-channel' },
        },
        config,
      ),
    ).toBe(false);
  });
});
