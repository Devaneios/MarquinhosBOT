import { describe, expect, it } from 'bun:test';
import {
  mintWsSessionToken,
  verifyWsSessionToken,
} from 'services/activity/wsSessionToken';
import { encryptToken } from 'utils/crypto';

describe('mintWsSessionToken / verifyWsSessionToken', () => {
  it('round-trips the userId, instanceId, guildId, mode and game', () => {
    const token = mintWsSessionToken({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'pong',
    });
    expect(verifyWsSessionToken(token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'pong',
    });
  });

  it('round-trips an optional difficulty', () => {
    const token = mintWsSessionToken({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
      difficulty: 'hard',
    });
    expect(verifyWsSessionToken(token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
      difficulty: 'hard',
    });
  });

  it('round-trips an optional display name', () => {
    const token = mintWsSessionToken({
      userId: 'user-1',
      displayName: 'Marquinhos',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'pong',
    });
    expect(verifyWsSessionToken(token)).toEqual({
      userId: 'user-1',
      displayName: 'Marquinhos',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'pong',
    });
  });

  it('round-trips an optional winningScore', () => {
    const token = mintWsSessionToken({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
      winningScore: 21,
    });
    expect(verifyWsSessionToken(token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
      winningScore: 21,
    });
  });

  it('round-trips mode "local"', () => {
    const token = mintWsSessionToken({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'local',
      game: 'pong',
    });
    expect(verifyWsSessionToken(token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'local',
      game: 'pong',
    });
  });

  it('rejects a payload with an invalid winningScore', () => {
    const malformed = encryptToken(
      JSON.stringify({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'single',
        game: 'pong',
        winningScore: 0,
      }),
    )!;
    expect(verifyWsSessionToken(malformed)).toBeNull();
  });

  it('rejects a payload with an invalid difficulty', () => {
    const malformed = encryptToken(
      JSON.stringify({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'single',
        game: 'pong',
        difficulty: 'nightmare',
      }),
    )!;
    expect(verifyWsSessionToken(malformed)).toBeNull();
  });

  it('rejects a tampered token', () => {
    const token = mintWsSessionToken({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'pong',
    });
    const tampered = `${token.slice(0, -4)}abcd`;
    expect(verifyWsSessionToken(tampered)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = encryptToken(
      JSON.stringify({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'pong',
      }),
      Date.now() - 1000,
    )!;
    expect(verifyWsSessionToken(expired)).toBeNull();
  });

  it('rejects a payload missing userId/instanceId/guildId/mode/game', () => {
    const malformed = encryptToken(JSON.stringify({ foo: 'bar' }))!;
    expect(verifyWsSessionToken(malformed)).toBeNull();
  });

  it('rejects a payload with an invalid mode', () => {
    const malformed = encryptToken(
      JSON.stringify({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'coop',
        game: 'pong',
      }),
    )!;
    expect(verifyWsSessionToken(malformed)).toBeNull();
  });

  it('rejects a payload missing game', () => {
    const malformed = encryptToken(
      JSON.stringify({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      }),
    )!;
    expect(verifyWsSessionToken(malformed)).toBeNull();
  });

  it('rejects a payload with an invalid game', () => {
    const malformed = encryptToken(
      JSON.stringify({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'chess',
      }),
    )!;
    expect(verifyWsSessionToken(malformed)).toBeNull();
  });

  it('round-trips a known ruleset and options bag for the cards game', () => {
    const token = mintWsSessionToken({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'cards',
      ruleset: 'truco',
      options: { seed: 42 },
    });
    expect(verifyWsSessionToken(token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'cards',
      ruleset: 'truco',
      options: { seed: 42 },
    });
  });

  it('rejects a cards payload with no ruleset', () => {
    const malformed = encryptToken(
      JSON.stringify({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'cards',
      }),
    )!;
    expect(verifyWsSessionToken(malformed)).toBeNull();
  });

  it('rejects a cards payload with an unknown ruleset', () => {
    const malformed = encryptToken(
      JSON.stringify({
        userId: 'user-1',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'cards',
        ruleset: 'poker',
      }),
    )!;
    expect(verifyWsSessionToken(malformed)).toBeNull();
  });

  it('ignores an absent ruleset for a non-cards game (pong unaffected)', () => {
    const token = mintWsSessionToken({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'pong',
    });
    expect(verifyWsSessionToken(token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'pong',
    });
  });

  it('round-trips an optional roomId for multi-mode sessions', () => {
    const token = mintWsSessionToken({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'pong',
      roomId: 'ABC123',
    });
    expect(verifyWsSessionToken(token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'pong',
      roomId: 'ABC123',
    });
  });

  it('omits roomId from the returned object when absent (single/local mode unaffected)', () => {
    const token = mintWsSessionToken({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
    });
    expect(verifyWsSessionToken(token)).toEqual({
      userId: 'user-1',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
    });
  });
});
