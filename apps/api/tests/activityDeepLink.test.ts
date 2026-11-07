import { describe, expect, it } from 'bun:test';
import { ActivityDeepLinkService } from 'modules/activity/activity-deep-link.service';
import { useTestDb } from './helpers/testDb';

const testDb = useTestDb();

function service(): ActivityDeepLinkService {
  return new ActivityDeepLinkService(testDb.current.db);
}

describe('ActivityDeepLinkService', () => {
  it('claims a freshly recorded intent and returns its game', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;
    const links = service();

    await links.record(userId, guildId, 'wordle');

    expect(await links.claim(userId, guildId)).toBe('wordle');
  });

  it('is one-time use: a second claim of the same intent returns null', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;
    const links = service();

    await links.record(userId, guildId, 'wordle');

    expect(await links.claim(userId, guildId)).toBe('wordle');
    expect(await links.claim(userId, guildId)).toBeNull();
  });

  it('returns null when there is no pending intent for that user/guild', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    expect(await service().claim(userId, guildId)).toBeNull();
  });

  it('scopes intents to the given guild', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildA = `guild-${crypto.randomUUID()}`;
    const guildB = `guild-${crypto.randomUUID()}`;
    const links = service();

    await links.record(userId, guildA, 'wordle');

    expect(await links.claim(userId, guildB)).toBeNull();
    expect(await links.claim(userId, guildA)).toBe('wordle');
  });

  it('replaces an unclaimed prior intent for the same user/guild', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;
    const links = service();

    await links.record(userId, guildId, 'wordle');
    await links.record(userId, guildId, 'wordle');

    expect(await links.claim(userId, guildId)).toBe('wordle');
    expect(await links.claim(userId, guildId)).toBeNull();
  });

  it('does not claim an intent older than the TTL', async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const guildId = `guild-${crypto.randomUUID()}`;

    await service().record(userId, guildId, 'wordle', Date.now() - 61_000);

    expect(await service().claim(userId, guildId)).toBeNull();
  });
});
