import { describe, expect, it } from 'bun:test';
import {
  activityTokenExchangeSchema,
  activityWsSessionSchema,
} from 'schemas/activity.schema';

describe('activityTokenExchangeSchema', () => {
  it('accepts a payload with a code', async () => {
    expect(
      activityTokenExchangeSchema.parseAsync({
        body: { code: 'auth-code-abc' },
        query: {},
        params: {},
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a payload missing code', async () => {
    expect(
      activityTokenExchangeSchema.parseAsync({
        body: {},
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects an empty code string', async () => {
    expect(
      activityTokenExchangeSchema.parseAsync({
        body: { code: '' },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });
});

describe('activityWsSessionSchema', () => {
  it('accepts a payload with accessToken, instanceId, guildId, mode and game', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          mode: 'multi',
          game: 'pong',
        },
        query: {},
        params: {},
      }),
    ).resolves.toBeDefined();
  });

  it('accepts mode "single"', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          mode: 'single',
          game: 'pong',
        },
        query: {},
        params: {},
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a payload missing instanceId', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          guildId: 'guild-1',
          mode: 'multi',
          game: 'pong',
        },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects a payload missing accessToken', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          instanceId: 'inst-1',
          guildId: 'guild-1',
          mode: 'multi',
          game: 'pong',
        },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects a payload missing guildId', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          mode: 'multi',
          game: 'pong',
        },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects a payload missing mode', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          game: 'pong',
        },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects an invalid mode value', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          mode: 'coop',
          game: 'pong',
        },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects a payload missing game', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          mode: 'multi',
        },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('accepts an optional difficulty value', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          mode: 'single',
          game: 'pong',
          difficulty: 'hard',
        },
        query: {},
        params: {},
      }),
    ).resolves.toBeDefined();
  });

  it('accepts a payload without a difficulty', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          mode: 'single',
          game: 'pong',
        },
        query: {},
        params: {},
      }),
    ).resolves.toBeDefined();
  });

  it('rejects an invalid difficulty value', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          mode: 'single',
          game: 'pong',
          difficulty: 'nightmare',
        },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('accepts game "cards"', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          mode: 'multi',
          game: 'cards',
        },
        query: {},
        params: {},
      }),
    ).resolves.toBeDefined();
  });

  it('rejects an invalid game value', async () => {
    expect(
      activityWsSessionSchema.parseAsync({
        body: {
          accessToken: 'tok_abc',
          instanceId: 'inst-1',
          guildId: 'guild-1',
          mode: 'multi',
          game: 'chess',
        },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('parses roomId through when present', () => {
    const result = activityWsSessionSchema.parse({
      body: {
        accessToken: 'token',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'tic-tac-toe',
        roomId: 'ABC123',
      },
    });
    expect(result.body.roomId).toBe('ABC123');
  });
});
