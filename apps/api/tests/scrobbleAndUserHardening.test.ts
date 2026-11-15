import { db } from '@marquinhos/database/client';
import { scrobblesQueue, users } from '@marquinhos/database/schema';
import { afterAll, describe, expect, it, mock } from 'bun:test';
import {
  signOAuthState,
  TokenCipherService,
  verifyOAuthState,
} from 'common/crypto';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { DiscordService } from 'integrations/discord/discord.service';
import { LastfmService } from 'integrations/lastfm/lastfm.service';
import type { SpotifyService } from 'integrations/spotify/spotify.service';
import { ParserService } from 'modules/scrobble/parser.service';
import { UserService } from 'modules/user/user.service';
import { createTestAppConfig } from './helpers/testAppConfig';

describe('deployment defaults', () => {
  it('preserves the configured service and guild defaults', () => {
    const config = createTestAppConfig({
      SEARXNG_URL: undefined,
      DISCORD_MAIN_GUILD_ID: undefined,
    });
    expect(config.searxngUrl).toBe('https://searxng.frois.net.br');
    expect(config.discordMainGuildId).toBe('305861924648779779');
  });
});

describe('OAuth CSRF state signing', () => {
  const cipherConfig = {
    secret: 'test-secret-key-at-least-16-chars',
    salt: 'test-salt-at-least-16-chars',
  };

  it('verifies fresh state and rejects tampered, malformed, or expired state', () => {
    const now = 1_700_000_000_000;
    const state = signOAuthState(cipherConfig, 'redirect-1', now);

    expect(verifyOAuthState(state, cipherConfig, now + 1_000)).toEqual({
      valid: true,
      customState: 'redirect-1',
    });
    expect(verifyOAuthState(`${state}x`, cipherConfig, now + 1_000)).toEqual({
      valid: false,
    });
    expect(verifyOAuthState(state, cipherConfig, now + 11 * 60_000)).toEqual({
      valid: false,
    });
    expect(verifyOAuthState('malformed', cipherConfig, now)).toEqual({
      valid: false,
    });
  });
});

describe('ParserService non-Spotify policy', () => {
  const basePlayback = {
    title: 'Artist - Track (Official Video)',
    listeningUsersId: ['u1'],
    timestamp: '2026-01-01T00:00:00Z',
    guildId: 'g1',
    channelId: 'c1',
  };

  it('skips Spotify search for non-Spotify playback when ALLOW_NON_SPOTIFY_SCROBBLES=false', async () => {
    const searchTrack = mock(async () => ({
      artist: 'A',
      name: 'B',
      durationInMillis: 180_000,
    }));
    const spotify = {
      searchTrack,
      getTrack: mock(),
    } as unknown as SpotifyService;
    const parser = new ParserService(
      spotify,
      createTestAppConfig({ ALLOW_NON_SPOTIFY_SCROBBLES: 'false' }),
    );

    await expect(
      parser.parseTrack({ ...basePlayback, providerName: 'youtube' }),
    ).resolves.toBeNull();
    expect(searchTrack).not.toHaveBeenCalled();

    await expect(
      parser.parseTrack({ ...basePlayback, providerName: 'Spotify' }),
    ).resolves.toMatchObject({ artist: 'A', name: 'B' });
    expect(searchTrack).toHaveBeenCalledTimes(1);
  });

  it('allows non-Spotify fallback search by default', async () => {
    const searchTrack = mock(async () => ({
      artist: 'A',
      name: 'B',
      durationInMillis: 180_000,
    }));
    const spotify = {
      searchTrack,
      getTrack: mock(),
    } as unknown as SpotifyService;
    const parser = new ParserService(spotify, createTestAppConfig());

    await expect(
      parser.parseTrack({ ...basePlayback, providerName: 'youtube' }),
    ).resolves.toMatchObject({ artist: 'A', name: 'B' });
    expect(searchTrack).toHaveBeenCalledTimes(1);
  });
});

describe('UserService top-items Spotify miss fallback', () => {
  const runId = randomUUID();
  const userId = `top-items-${runId}`;

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId));
  });

  it('preserves Last.fm items with empty coverArtUrl when Spotify returns null or rejects', async () => {
    await db
      .insert(users)
      .values({ id: userId, lastfm_username: 'lfm-user' })
      .onConflictDoNothing();

    const config = createTestAppConfig();
    const fakeLastfm = {
      getUserInfo: mock(async () => ({ realname: 'Maria Silva' })),
      getTopArtists: mock(async () => [
        { name: 'Artist One' },
        { name: 'Artist Two' },
      ]),
      getTopAlbums: mock(async () => [
        { name: 'Album One', artist: 'Artist One' },
        { name: 'Album Two', artist: 'Artist Two' },
      ]),
      getTopTracks: mock(async () => [
        { name: 'Track One', artist: 'Artist One' },
        { name: 'Track Two', artist: 'Artist Two' },
      ]),
    } as unknown as LastfmService;

    const fakeSpotify = {
      searchArtist: mock(async (q: string) =>
        q === 'Artist One'
          ? { name: 'Artist One (Spotify)', coverArtUrl: 'https://img/a1' }
          : Promise.reject(new Error('spotify timeout')),
      ),
      searchAlbum: mock(async (q: string) =>
        q === 'Album One'
          ? { name: 'Album One (Spotify)', coverArtUrl: 'https://img/al1' }
          : null,
      ),
      searchTrack: mock(async (q: string) =>
        q.startsWith('Track One')
          ? { name: 'Track One (Spotify)', coverArtUrl: 'https://img/t1' }
          : null,
      ),
    } as unknown as SpotifyService;

    const service = new UserService(
      db,
      new DiscordService(config),
      fakeLastfm,
      fakeSpotify,
      new TokenCipherService(config),
    );

    await expect(service.getTopArtists(userId, '7day')).resolves.toEqual({
      profileName: 'Maria',
      artists: [
        { name: 'Artist One (Spotify)', coverArtUrl: 'https://img/a1' },
        { name: 'Artist Two', coverArtUrl: '' },
      ],
    });

    await expect(service.getTopAlbums(userId, '7day')).resolves.toEqual({
      profileName: 'Maria',
      albums: [
        { name: 'Album One (Spotify)', coverArtUrl: 'https://img/al1' },
        { name: 'Album Two', coverArtUrl: '' },
      ],
    });

    await expect(service.getTopTracks(userId, '7day')).resolves.toEqual({
      profileName: 'Maria',
      tracks: [
        { name: 'Track One (Spotify)', coverArtUrl: 'https://img/t1' },
        { name: 'Track Two', coverArtUrl: '' },
      ],
    });
  });
});

describe('LastfmService queue retry and backoff', () => {
  const runId = randomUUID();
  const userId = `scrobble-retry-${runId}`;
  const createdQueueIds: string[] = [];

  afterAll(async () => {
    for (const id of createdQueueIds) {
      await db.delete(scrobblesQueue).where(eq(scrobblesQueue.id, id));
    }
    await db.delete(users).where(eq(users.id, userId));
  });

  it('retries due rows beyond the first page of pending entries', async () => {
    const now = Math.floor(Date.now() / 1000);
    const playback = {
      title: 'Artist - Track',
      providerName: 'spotify',
      listeningUsersId: [],
      timestamp: '2026-01-01T00:00:00Z',
      guildId: 'g1',
      channelId: 'c1',
    };
    const rows = Array.from({ length: 101 }, (_, index) => {
      const id = `page-${runId}-${index}`;
      createdQueueIds.push(id);
      return {
        id,
        track: JSON.stringify({
          name: 'Track',
          artist: 'Artist',
          durationInMillis: 180_000,
        }),
        playback_data: JSON.stringify({
          ...playback,
          retryCount: 1,
          nextRetryAt: Date.now() + 60_000,
        }),
        created_at: now - 1000 + index,
      };
    });
    const dueId = `page-${runId}-due`;
    createdQueueIds.push(dueId);
    rows.push({
      ...rows[0]!,
      id: dueId,
      playback_data: JSON.stringify({
        ...playback,
        retryCount: 1,
        nextRetryAt: Date.now() - 1000,
      }),
      created_at: now - 800,
    });
    await db.insert(scrobblesQueue).values(rows);
    const lastfm = new LastfmService(db, createTestAppConfig());
    await expect(lastfm.retryPendingScrobbles(1)).resolves.toBe(1);
    expect(
      await db
        .select()
        .from(scrobblesQueue)
        .where(eq(scrobblesQueue.id, dueId)),
    ).toHaveLength(0);
    for (const row of rows)
      await db.delete(scrobblesQueue).where(eq(scrobblesQueue.id, row.id));
  });

  it('schedules backoff on transient error, skips immature rows, retries due rows, and drops after max attempts', async () => {
    await db
      .insert(users)
      .values({
        id: userId,
        lastfm_username: 'lfm-retry',
        lastfm_session_token: 'plain-session-key',
        scrobbles_on: true,
      })
      .onConflictDoNothing();

    const config = createTestAppConfig();
    const lastfm = new LastfmService(db, config);
    let failMode: 'fail' | 'succeed' = 'fail';
    lastfm.scrobble = mock(async () => {
      if (failMode === 'fail') {
        throw new Error('LastfmRequestUnknownError');
      }
    });

    const queueId = `q-${runId}-1`;
    createdQueueIds.push(queueId);
    const playback = {
      title: 'Artist - Track',
      providerName: 'spotify',
      listeningUsersId: [userId],
      timestamp: '2026-01-01T00:00:00Z',
      guildId: 'g1',
      channelId: 'c1',
    };
    await db.insert(scrobblesQueue).values({
      id: queueId,
      track: JSON.stringify({
        name: 'Track',
        artist: 'Artist',
        durationInMillis: 180_000,
      }),
      playback_data: JSON.stringify(playback),
      created_at: Math.floor(Date.now() / 1000),
    });

    // Attempt 1 fails -> kept in queue with retryCount=1 and future nextRetryAt
    await lastfm.dispatchScrobbleFromQueue(queueId);
    const [afterFirst] = await db
      .select()
      .from(scrobblesQueue)
      .where(eq(scrobblesQueue.id, queueId));
    expect(afterFirst).toBeDefined();
    const firstPayload = JSON.parse(afterFirst!.playback_data) as {
      retryCount?: number;
      nextRetryAt?: number;
    };
    expect(firstPayload.retryCount).toBe(1);
    expect(firstPayload.nextRetryAt).toBeGreaterThan(Date.now());

    // Immature retry is skipped
    await expect(lastfm.retryPendingScrobbles(10)).resolves.toBe(0);

    // Make retry due and succeed -> deletes queue entry
    await db
      .update(scrobblesQueue)
      .set({
        playback_data: JSON.stringify({
          ...playback,
          retryCount: 1,
          nextRetryAt: Date.now() - 1_000,
        }),
      })
      .where(eq(scrobblesQueue.id, queueId));

    failMode = 'succeed';
    await expect(lastfm.retryPendingScrobbles(10)).resolves.toBe(1);
    const remaining = await db
      .select()
      .from(scrobblesQueue)
      .where(eq(scrobblesQueue.id, queueId));
    expect(remaining).toHaveLength(0);

    // Exceeding max retry attempts (>3) drops the row permanently
    const exhaustId = `q-${runId}-2`;
    createdQueueIds.push(exhaustId);
    await db.insert(scrobblesQueue).values({
      id: exhaustId,
      track: JSON.stringify({
        name: 'Track',
        artist: 'Artist',
        durationInMillis: 180_000,
      }),
      playback_data: JSON.stringify({
        ...playback,
        retryCount: 3,
        nextRetryAt: Date.now() - 1_000,
      }),
      created_at: Math.floor(Date.now() / 1000),
    });
    failMode = 'fail';
    await expect(lastfm.retryPendingScrobbles(10)).resolves.toBe(1);
    const afterExhaust = await db
      .select()
      .from(scrobblesQueue)
      .where(eq(scrobblesQueue.id, exhaustId));
    expect(afterExhaust).toHaveLength(0);
  });
});
