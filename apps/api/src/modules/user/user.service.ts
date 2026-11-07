import type { Track } from '@marquinhos/contracts/http/routes/scrobble';
import type { LastfmTopListenedPeriod } from '@marquinhos/contracts/http/routes/user';
import type { Db } from '@marquinhos/database/client';
import {
  activityDeepLinks,
  aiResearchJobs,
  aiThreadSessions,
  aiTraces,
  evolutiveAchievements,
  mazeSessions,
  pongRatings,
  userAchievements,
  userGameResults,
  userLevels,
  users,
  userStats,
  wordleChallengeJoins,
  wordleCommunityDailyPresence,
  wordleCommunityFirstSolves,
  wordleCommunityParticipation,
  wordleCommunityWinAnnouncements,
  wordleDrafts,
  wordleGlobalAchievements,
  wordleGlobalDiscoveries,
  wordleGlobalDrafts,
  wordleGlobalOccurrences,
  wordleGlobalSessions,
  wordleGoalAwards,
  wordlePatternChallenges,
  wordlePatternDiscoveries,
  wordlePersonalRewards,
  wordleSessions,
  wordleShowcase,
  wordleStreaks,
  wordleUserConfig,
  xpCooldowns,
} from '@marquinhos/database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { TokenCipherService } from 'common/crypto';
import { DB } from 'database/database.tokens';
import { eq, not, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { DiscordService } from 'integrations/discord/discord.service';
import { LastfmService } from 'integrations/lastfm/lastfm.service';
import { SpotifyService } from 'integrations/spotify/spotify.service';
import { lockGoalFactsForWrite } from 'modules/wordle/services/goal-fact-lock';

// Everything the privacy policy's "delete all your data" covers. Left out
// on purpose: AI usage counters (deleting them would reset quotas), sandbox
// sessions (the sweep needs the row to stop the container), and Pong
// tournaments and ranked matches, which other players' results depend on.
// Child rows (AI trace events, thread items, research events) go with their
// parent through ON DELETE CASCADE (migration 0004), so they are not listed.
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
  [wordlePatternDiscoveries, wordlePatternDiscoveries.user_id],
  [wordleGlobalSessions, wordleGlobalSessions.user_id],
  [wordleGlobalDrafts, wordleGlobalDrafts.user_id],
  [wordleGlobalAchievements, wordleGlobalAchievements.user_id],
  [wordleChallengeJoins, wordleChallengeJoins.user_id],
  [wordleGoalAwards, wordleGoalAwards.user_id],
  [wordlePersonalRewards, wordlePersonalRewards.user_id],
  [wordleGlobalDiscoveries, wordleGlobalDiscoveries.user_id],
  [wordleGlobalOccurrences, wordleGlobalOccurrences.user_id],
  [wordleCommunityDailyPresence, wordleCommunityDailyPresence.user_id],
  [wordleCommunityFirstSolves, wordleCommunityFirstSolves.user_id],
  [wordleCommunityWinAnnouncements, wordleCommunityWinAnnouncements.user_id],
  [wordleCommunityParticipation, wordleCommunityParticipation.user_id],
  [wordleShowcase, wordleShowcase.user_id],
  [wordleDrafts, wordleDrafts.user_id],
  [wordleSessions, wordleSessions.user_id],
  [wordleStreaks, wordleStreaks.user_id],
  [wordleUserConfig, wordleUserConfig.user_id],
  [pongRatings, pongRatings.user_id],
  [users, users.id],
];

async function findUser(db: Db, id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}

@Injectable()
export class UserService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly discordService: DiscordService,
    private readonly lastfmService: LastfmService,
    private readonly spotifyService: SpotifyService,
    private readonly tokenCipher: TokenCipherService,
  ) {}

  async create(id: string) {
    // Atomic upsert — avoids SELECT-then-INSERT race condition (14.4)
    await this.db.insert(users).values({ id }).onConflictDoNothing();
    return { id };
  }

  async enableLastfm(id: string, token: string) {
    const user = await findUser(this.db, id);

    if (!user) {
      throw new Error('User not found');
    }

    const sessionToken = await this.lastfmService.getSession(token);

    if (!sessionToken) {
      throw new Error('Invalid token');
    }

    // Encrypt the session token before persisting (P0 security fix)
    const encrypted = this.tokenCipher.encryptToken(sessionToken.sessionKey);
    if (!encrypted) {
      throw new Error('Failed to encrypt session token');
    }
    await this.db
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
    const user = await findUser(this.db, id);

    if (!user) {
      throw new Error('User not found');
    }

    await this.db
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
    await this.db.transaction(async (tx) => {
      await lockGoalFactsForWrite(tx);
      for (const [table, column] of USER_OWNED_TABLES) {
        await tx.delete(table).where(eq(column, id));
      }
      await tx
        .update(wordlePatternChallenges)
        .set({ creator_user_id: null })
        .where(eq(wordlePatternChallenges.creator_user_id, id));
    });
  }

  async toggleScrobbles(id: string) {
    // One statement, so two concurrent toggles can't both read the old value.
    const [row] = await this.db
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
    const row = await findUser(this.db, id);

    if (!row) {
      return null;
    }

    return { id };
  }

  async hasValidLastfmSessionToken(id: string) {
    const row = await findUser(this.db, id);

    if (!row) {
      throw new Error('User not found');
    }

    if (!row.lastfm_session_token) {
      return null;
    }

    const sessionKey = this.tokenCipher.decryptToken(row.lastfm_session_token);
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
    const row = await findUser(this.db, id);

    if (!row) {
      throw new Error('User not found');
    }

    return row.lastfm_username ?? null;
  }

  async getTopArtists(id: string, period: LastfmTopListenedPeriod) {
    const row = await findUser(this.db, id);

    if (!row) {
      throw new Error('User not found');
    }

    const username = row.lastfm_username ?? '';
    const sessionKey = row.lastfm_session_token
      ? (this.tokenCipher.decryptToken(row.lastfm_session_token) ?? undefined)
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
    const row = await findUser(this.db, id);

    if (!row) {
      throw new Error('User not found');
    }

    const username = row.lastfm_username ?? '';
    const sessionKey = row.lastfm_session_token
      ? (this.tokenCipher.decryptToken(row.lastfm_session_token) ?? undefined)
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
    const row = await findUser(this.db, id);

    if (!row) {
      throw new Error('User not found');
    }

    const username = row.lastfm_username ?? '';
    const sessionKey = row.lastfm_session_token
      ? (this.tokenCipher.decryptToken(row.lastfm_session_token) ?? undefined)
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
