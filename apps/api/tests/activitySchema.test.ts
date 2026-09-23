import {
  exchangeToken,
  wsSession,
} from '@marquinhos/contracts/http/routes/activity';
import { describe, expect, it } from 'bun:test';

describe('exchangeToken body', () => {
  it('accepts a payload with a code', () => {
    expect(
      exchangeToken.body.safeParse({ code: 'auth-code-abc' }).success,
    ).toBe(true);
  });

  it('rejects a payload missing code', () => {
    expect(exchangeToken.body.safeParse({}).success).toBe(false);
  });

  it('rejects an empty code string', () => {
    expect(exchangeToken.body.safeParse({ code: '' }).success).toBe(false);
  });
});

describe('wsSession body', () => {
  it('rejects a multi-mode payload without a roomId', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'pong',
      }).success,
    ).toBe(false);
  });

  it('accepts a payload with accessToken, instanceId, guildId, mode and game', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'pong',
        roomId: 'ROOM01',
      }).success,
    ).toBe(true);
  });

  it('accepts mode "single"', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'single',
        game: 'pong',
      }).success,
    ).toBe(true);
  });

  it('rejects a payload missing instanceId', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'pong',
      }).success,
    ).toBe(false);
  });

  it('rejects a payload missing accessToken', () => {
    expect(
      wsSession.body.safeParse({
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'pong',
      }).success,
    ).toBe(false);
  });

  it('rejects a payload missing guildId', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        mode: 'multi',
        game: 'pong',
      }).success,
    ).toBe(false);
  });

  it('rejects a payload missing mode', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        game: 'pong',
      }).success,
    ).toBe(false);
  });

  it('rejects an invalid mode value', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'coop',
        game: 'pong',
      }).success,
    ).toBe(false);
  });

  it('rejects a payload missing game', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      }).success,
    ).toBe(false);
  });

  it('accepts an optional difficulty value', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'single',
        game: 'pong',
        difficulty: 'hard',
      }).success,
    ).toBe(true);
  });

  it('accepts a payload without a difficulty', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'single',
        game: 'pong',
      }).success,
    ).toBe(true);
  });

  it('rejects an invalid difficulty value', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'single',
        game: 'pong',
        difficulty: 'nightmare',
      }).success,
    ).toBe(false);
  });

  it('accepts game "cards"', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'cards',
        roomId: 'ROOM01',
      }).success,
    ).toBe(true);
  });

  it('rejects an invalid game value', () => {
    expect(
      wsSession.body.safeParse({
        accessToken: 'tok_abc',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'chess',
      }).success,
    ).toBe(false);
  });

  it('parses roomId through when present', () => {
    const result = wsSession.body.parse({
      accessToken: 'token',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'tic-tac-toe',
      roomId: 'ABC123',
    });
    expect(result.roomId).toBe('ABC123');
  });
});
