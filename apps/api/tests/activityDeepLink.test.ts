import { beforeAll, describe, expect, it } from 'bun:test';

let recordDeepLink: typeof import('../src/services/activityDeepLink').recordDeepLink;
let claimDeepLink: typeof import('../src/services/activityDeepLink').claimDeepLink;

beforeAll(async () => {
  ({ recordDeepLink, claimDeepLink } =
    await import('../src/services/activityDeepLink'));
});

describe('activityDeepLink', () => {
  it('claims a freshly recorded intent and returns its game', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    await recordDeepLink(userId, guildId, 'wordle');

    expect(await claimDeepLink(userId, guildId)).toBe('wordle');
  });

  it('is one-time use: a second claim of the same intent returns null', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    await recordDeepLink(userId, guildId, 'wordle');

    expect(await claimDeepLink(userId, guildId)).toBe('wordle');
    expect(await claimDeepLink(userId, guildId)).toBeNull();
  });

  it('returns null when there is no pending intent for that user/guild', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    expect(await claimDeepLink(userId, guildId)).toBeNull();
  });

  it('scopes intents to the given guild', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildA = `guild-${crypto.randomUUID()}`;
    const guildB = `guild-${crypto.randomUUID()}`;

    await recordDeepLink(userId, guildA, 'wordle');

    expect(await claimDeepLink(userId, guildB)).toBeNull();
    expect(await claimDeepLink(userId, guildA)).toBe('wordle');
  });

  it('replaces an unclaimed prior intent for the same user/guild', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    await recordDeepLink(userId, guildId, 'wordle');
    await recordDeepLink(userId, guildId, 'wordle');

    expect(await claimDeepLink(userId, guildId)).toBe('wordle');
    expect(await claimDeepLink(userId, guildId)).toBeNull();
  });

  it('does not claim an intent older than the TTL', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    await recordDeepLink(userId, guildId, 'wordle', Date.now() - 61_000);

    expect(await claimDeepLink(userId, guildId)).toBeNull();
  });
});
