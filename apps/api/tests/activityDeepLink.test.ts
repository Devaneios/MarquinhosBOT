import { beforeAll, describe, expect, it } from 'bun:test';

// Set in-memory db BEFORE any imports that load the db module — mirrors
// tests/wordleAnnouncement.test.ts so this suite doesn't touch the real marquinhos.db.
process.env.SQLITE_PATH = ':memory:';

let recordDeepLink: typeof import('../src/services/activityDeepLink').recordDeepLink;
let claimDeepLink: typeof import('../src/services/activityDeepLink').claimDeepLink;

beforeAll(async () => {
  ({ recordDeepLink, claimDeepLink } =
    await import('../src/services/activityDeepLink'));
});

describe('activityDeepLink', () => {
  it('claims a freshly recorded intent and returns its game', () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    recordDeepLink(userId, guildId, 'wordle');

    expect(claimDeepLink(userId, guildId)).toBe('wordle');
  });

  it('is one-time use: a second claim of the same intent returns null', () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    recordDeepLink(userId, guildId, 'wordle');

    expect(claimDeepLink(userId, guildId)).toBe('wordle');
    expect(claimDeepLink(userId, guildId)).toBeNull();
  });

  it('returns null when there is no pending intent for that user/guild', () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    expect(claimDeepLink(userId, guildId)).toBeNull();
  });

  it('scopes intents to the given guild', () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildA = `guild-${crypto.randomUUID()}`;
    const guildB = `guild-${crypto.randomUUID()}`;

    recordDeepLink(userId, guildA, 'wordle');

    expect(claimDeepLink(userId, guildB)).toBeNull();
    expect(claimDeepLink(userId, guildA)).toBe('wordle');
  });

  it('replaces an unclaimed prior intent for the same user/guild', () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    recordDeepLink(userId, guildId, 'wordle');
    recordDeepLink(userId, guildId, 'wordle');

    expect(claimDeepLink(userId, guildId)).toBe('wordle');
    expect(claimDeepLink(userId, guildId)).toBeNull();
  });

  it('does not claim an intent older than the TTL', () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    recordDeepLink(userId, guildId, 'wordle', Date.now() - 61_000);

    expect(claimDeepLink(userId, guildId)).toBeNull();
  });
});
