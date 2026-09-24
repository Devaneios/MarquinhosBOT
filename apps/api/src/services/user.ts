import type { Track } from '@marquinhos/contracts/http/routes/scrobble';
import type { LastfmTopListenedPeriod } from '@marquinhos/contracts/http/routes/user';
import { db } from '@marquinhos/database/client';
import {
  activityDeepLinks,
  aiResearchEvents,
  aiResearchJobs,
  aiThreadItems,
  aiThreadSessions,
  aiTraceEvents,
  aiTraces,
  evolutiveAchievements,
  mazeSessions,
  pongRatings,
  userAchievements,
  userGameResults,
  userLevels,
  users,
  userStats,
  wordleSessions,
  wordleStreaks,
  wordleUserConfig,
  xpCooldowns,
} from '@marquinhos/database/schema';
import dotenv from 'dotenv';
import { eq, inArray, not, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { DiscordService } from 'services/discord';
import { LastfmService } from 'services/lastfm';
import { SpotifyService } from 'services/spotify';
import { decryptToken, encryptToken } from 'utils/crypto';

dotenv.config();

// Everything the privacy policy's "delete all your data" covers. Left out
// on purpose: AI usage counters (deleting them would reset quotas), sandbox
// sessions (the sweep needs the row to stop the container), and Pong
// tournaments and ranked matches, which other players' results depend on.
const USER_OWNED_TABLES: readonly (readonly [
  table: PgTable,
  column: PgColumn,
])[] = [
  [aiTraces, aiTraces.user_id],
  [aiThreadSessions, aiThreadSessions.owner_user_id],
  [aiResearchJobs, aiResearchJobs.user_id],
  [userLevels, userLevels.user_id],
  [userAchievements, userAchievements.user_id],
  [userStats, userStats.user_id],
  [xpCooldowns, xpCooldowns.user_id],
  [userGameResults, userGameResults.user_id],
  [evolutiveAchievements, evolutiveAchievements.user_id],
  [mazeSessions, mazeSessions.user_id],
  [activityDeepLinks, activityDeepLinks.user_id],
  [wordleSessions, wordleSessions.user_id],
  [wordleStreaks, wordleStreaks.user_id],
  [wordleUserConfig, wordleUserConfig.user_id],
  [pongRatings, pongRatings.user_id],
  [users, users.id],
];

async function findUser(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}

export class UserService {
  discordService: DiscordService;
  lastfmService: LastfmService;
  spotifyService: SpotifyService;

  constructor() {
    this.discordService = new DiscordService();
    this.lastfmService = new LastfmService();
    this.spotifyService = new SpotifyService();
  }

  async create(id: string) {
    // Atomic upsert — avoids SELECT-then-INSERT race condition (14.4)
    await db.insert(users).values({ id }).onConflictDoNothing();
    return { id };
  }

  async enableLastfm(id: string, token: string) {
    const user = await findUser(id);

    if (!user) {
      throw new Error('User not found');
    }

    const sessionToken = await this.lastfmService.getSession(token);

    if (!sessionToken) {
      throw new Error('Invalid token');
    }

    // Encrypt the session token before persisting (P0 security fix)
    const encrypted = encryptToken(sessionToken.sessionKey);
    if (!encrypted) {
      throw new Error('Failed to encrypt session token');
    }
    await db
      .update(users)
      .set({
        lastfm_session_token: encrypted,
        lastfm_username: sessionToken.userName,
        scrobbles_on: true,
      })
      .where(eq(users.id, id));

    return { id };
  }

  async deleteLastfmData(id: string) {
    const user = await findUser(id);

    if (!user) {
      throw new Error('User not found');
    }

    await db
      .update(users)
      .set({
        lastfm_session_token: null,
        lastfm_username: null,
        scrobbles_on: null,
      })
      .where(eq(users.id, id));

    return { id };
  }

  async deleteAllData(id: string) {
    await db.transaction(async (tx) => {
      await tx
        .delete(aiTraceEvents)
        .where(
          inArray(
            aiTraceEvents.trace_id,
            tx
              .select({ id: aiTraces.trace_id })
              .from(aiTraces)
              .where(eq(aiTraces.user_id, id)),
          ),
        );
      await tx
        .delete(aiThreadItems)
        .where(
          inArray(
            aiThreadItems.thread_id,
            tx
              .select({ id: aiThreadSessions.thread_id })
              .from(aiThreadSessions)
              .where(eq(aiThreadSessions.owner_user_id, id)),
          ),
        );
      await tx
        .delete(aiResearchEvents)
        .where(
          inArray(
            aiResearchEvents.job_id,
            tx
              .select({ id: aiResearchJobs.job_id })
              .from(aiResearchJobs)
              .where(eq(aiResearchJobs.user_id, id)),
          ),
        );
      for (const [table, column] of USER_OWNED_TABLES) {
        await tx.delete(table).where(eq(column, id));
      }
    });
  }

  async toggleScrobbles(id: string) {
    // One statement, so two concurrent toggles can't both read the old value.
    const [row] = await db
      .update(users)
      .set({ scrobbles_on: not(sql`coalesce(${users.scrobbles_on}, false)`) })
      .where(eq(users.id, id))
      .returning({ scrobblesOn: users.scrobbles_on });

    if (!row) {
      throw new Error('User not found');
    }

    return { id, scrobblesOn: row.scrobblesOn === true };
  }

  async exists(id: string) {
    const row = await findUser(id);

    if (!row) {
      return null;
    }

    return { id };
  }

  async hasValidLastfmSessionToken(id: string) {
    const row = await findUser(id);

    if (!row) {
      throw new Error('User not found');
    }

    if (!row.lastfm_session_token) {
      return null;
    }

    const sessionKey = decryptToken(row.lastfm_session_token);
    if (!sessionKey) {
      return null;
    }

    const lastfmUser = await this.lastfmService.getUserInfo(sessionKey);

    if (!lastfmUser) {
      return null;
    }

    return { id, scrobblesOn: row.scrobbles_on === true };
  }

  async getLastfmUsername(id: string) {
    const row = await findUser(id);

    if (!row) {
      throw new Error('User not found');
    }

    return row.lastfm_username ?? null;
  }

  async getTopArtists(id: string, period: LastfmTopListenedPeriod) {
    const row = await findUser(id);

    if (!row) {
      throw new Error('User not found');
    }

    const username = row.lastfm_username ?? '';
    const sessionKey = row.lastfm_session_token
      ? (decryptToken(row.lastfm_session_token) ?? undefined)
      : undefined;

    const profileName = (
      await this.lastfmService.getUserInfo(sessionKey)
    ).realname.split(' ')[0];
    const topArtists = await this.lastfmService.getTopArtists(username, period);
    const artistsPromises: Promise<{
      name: string;
      coverArtUrl?: string;
    } | null>[] = [];

    for (const artist of topArtists) {
      const spotifyArtist = this.spotifyService.searchArtist(artist.name);
      artistsPromises.push(spotifyArtist);
    }

    const spotifyArtsits = await Promise.all(artistsPromises);

    const artists = spotifyArtsits
      .map((artist) => {
        if (!artist) {
          return;
        }

        if (!artist.coverArtUrl) {
          return;
        }

        return {
          name: artist.name,
          coverArtUrl: artist.coverArtUrl,
        };
      })
      .filter(
        (artist): artist is { name: string; coverArtUrl: string } =>
          artist !== null && artist !== undefined,
      )
      .slice(0, 10);
    // TODO: Return not found artists
    return { artists, profileName };
  }

  async getTopAlbums(id: string, period: LastfmTopListenedPeriod) {
    const row = await findUser(id);

    if (!row) {
      throw new Error('User not found');
    }

    const username = row.lastfm_username ?? '';
    const sessionKey = row.lastfm_session_token
      ? (decryptToken(row.lastfm_session_token) ?? undefined)
      : undefined;

    const profileName = (
      await this.lastfmService.getUserInfo(sessionKey)
    ).realname.split(' ')[0];

    const topAlbums = await this.lastfmService.getTopAlbums(username, period);

    const albumsPromises: Promise<{ name: string; coverArtUrl?: string }>[] =
      [];

    for (const album of topAlbums) {
      const spotifyAlbum = this.spotifyService.searchAlbum(album.name);
      albumsPromises.push(spotifyAlbum);
    }

    const spotifyAlbums = await Promise.all(albumsPromises);

    const albums = spotifyAlbums
      .map((album) => {
        if (!album) {
          return;
        }

        if (!album.coverArtUrl) {
          return;
        }

        return {
          name: album.name,
          coverArtUrl: album.coverArtUrl,
        };
      })
      .filter(
        (album): album is { name: string; coverArtUrl: string } =>
          album !== null && album !== undefined,
      )
      .slice(0, 10);
    // TODO: Return not found albums
    return { albums, profileName };
  }

  async getTopTracks(id: string, period: LastfmTopListenedPeriod) {
    const row = await findUser(id);

    if (!row) {
      throw new Error('User not found');
    }

    const username = row.lastfm_username ?? '';
    const sessionKey = row.lastfm_session_token
      ? (decryptToken(row.lastfm_session_token) ?? undefined)
      : undefined;

    const profileName = (
      await this.lastfmService.getUserInfo(sessionKey)
    ).realname.split(' ')[0];

    const topTracks = await this.lastfmService.getTopTracks(username, period);

    const tracksPromises: Promise<Pick<Track, 'name' | 'coverArtUrl'>>[] = [];

    for (const track of topTracks) {
      const spotifyTrack = this.spotifyService.searchTrack(
        `${track.name} ${track.artist}`,
        'minimal',
      );
      tracksPromises.push(spotifyTrack);
    }

    const spotifyTracks = await Promise.all(tracksPromises);

    const tracks = spotifyTracks
      .map((track) => {
        if (!track) {
          return;
        }

        if (!track.coverArtUrl) {
          return;
        }

        return {
          name: track.name,
          coverArtUrl: track.coverArtUrl,
        };
      })
      .filter(
        (track): track is { name: string; coverArtUrl: string } =>
          track !== null && track !== undefined,
      )
      .slice(0, 10);

    // TODO: Return not found tracks
    return { tracks, profileName };
  }
}
