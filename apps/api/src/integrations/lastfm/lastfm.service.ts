/**
MIT License

Copyright (c) 2020 Erick Almeida (https://github.com/Erick2280)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

import {
  playbackDataSchema,
  trackSchema,
  type PlaybackData,
  type Track,
} from '@marquinhos/contracts/http/routes/scrobble';
import type { LastfmTopListenedPeriod } from '@marquinhos/contracts/http/routes/user';
import type { Db, DbExecutor } from '@marquinhos/database/client';
import { scrobblesQueue, users } from '@marquinhos/database/schema';
import { Inject, Injectable, Optional } from '@nestjs/common';
import axios from 'axios';
import { TokenCipherService } from 'common/crypto';
import { log } from 'common/logging/logger';
import { AppConfig } from 'config/app.config';
import crypto from 'crypto';
import { DB } from 'database/database.tokens';
import { getUnixTime, parseISO } from 'date-fns';
import { and, asc, eq, gt, or } from 'drizzle-orm';
import type { LastfmSessionResponse } from 'types';
import { URLSearchParams } from 'url';
import { z } from 'zod';
// URLSearchParams is available globally in Node.js >= 15 but we import for clarity

const LASTFM_REQUEST_TIMEOUT_MS = 10_000;
const SCROBBLE_RETRY_MAX_ATTEMPTS = 3;
const SCROBBLE_RETRY_BASE_MS = 30_000;
const ORPHANED_SCROBBLE_AGE_SECONDS = 600;

// Request errors carry the signed URL (session key) in their config, so
// they go through the structured logger, which keeps only message and stack.
const logger = {
  error: (message: string, error?: unknown) =>
    log('error', `lastfm: ${message}`, { error }),
  warn: (message: string, error?: unknown) =>
    log('warn', `lastfm: ${message}`, { error }),
};

const lastfmErrorBodySchema = z.object({ error: z.number() });

export function getLastfmErrorCode(error: unknown): number | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const body = lastfmErrorBodySchema.safeParse(error.response?.data);
  return body.success ? body.data.error : undefined;
}

enum RowLock {
  None,
  ForUpdate,
}

async function findScrobble(
  exec: DbExecutor,
  scrobbleId: string,
  lock: RowLock = RowLock.None,
) {
  const query = exec
    .select({
      track: scrobblesQueue.track,
      playback_data: scrobblesQueue.playback_data,
    })
    .from(scrobblesQueue)
    .where(eq(scrobblesQueue.id, scrobbleId));
  const [row] =
    lock === RowLock.ForUpdate ? await query.for('update') : await query;
  return row;
}

async function setPlaybackData(
  exec: DbExecutor,
  scrobbleId: string,
  playbackData: PlaybackData,
): Promise<void> {
  await exec
    .update(scrobblesQueue)
    .set({ playback_data: JSON.stringify(playbackData) })
    .where(eq(scrobblesQueue.id, scrobbleId));
}

async function findUser(db: Db, userId: string) {
  const [row] = await db
    .select({
      lastfm_session_token: users.lastfm_session_token,
      scrobbles_on: users.scrobbles_on,
    })
    .from(users)
    .where(eq(users.id, userId));
  return row;
}

@Injectable()
export class LastfmService {
  readonly apiRootUrl = 'https://ws.audioscrobbler.com/2.0';
  readonly userAgent = 'cordscrobbler/1.0.0';

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: AppConfig,
    @Optional() private readonly tokenCipher?: TokenCipherService,
  ) {}

  private resolveSessionToken(
    stored: string | null | undefined,
  ): string | null {
    if (!stored) return null;
    if (stored.includes(':') && this.tokenCipher) {
      return this.tokenCipher.decryptToken(stored);
    }
    return stored;
  }

  async getSession(token: string | undefined): Promise<LastfmSessionResponse> {
    if (!token) {
      throw new Error('LastfmTokenNotProvided');
    }

    const params = new URLSearchParams();
    params.set('method', 'auth.getsession');
    params.set('token', token);
    let request;
    try {
      request = await this._performRequest(params, 'get', true);
    } catch (error: unknown) {
      const errorCode = getLastfmErrorCode(error);
      if (errorCode === 14) {
        throw new Error('LastfmTokenNotAuthorized', { cause: error });
      }
      if (errorCode === 11 || errorCode === 16) {
        throw new Error('LastfmServiceUnavailable', { cause: error });
      } else {
        logger.error('LastfmRequestUnknownError:', error);
        throw new Error('LastfmRequestUnknownError', { cause: error });
      }
    }

    const userName = request?.data.session.name;
    const sessionKey = request?.data.session.key;

    return {
      sessionKey,
      userName,
    };
  }

  async scrobble(
    tracks: Track[],
    playbacksData: PlaybackData[],
    sessionKey: string | undefined,
  ) {
    const params = new URLSearchParams();

    params.set('method', 'track.scrobble');
    params.set('sk', sessionKey || '');

    for (const [i, track] of tracks.entries()) {
      const playbackData = playbacksData[i];
      if (!playbackData) continue;

      params.set(`artist[${i}]`, track.artist);
      params.set(`track[${i}]`, track.name);
      params.set(
        `timestamp[${i}]`,
        getUnixTime(parseISO(playbackData.timestamp)).toString(),
      );
      if (track.album) {
        params.set(`album[${i}]`, track.album);
      }
    }

    try {
      await this._performRequest(params, 'post', true);
    } catch (error: unknown) {
      const errorCode = getLastfmErrorCode(error);
      if (errorCode === 9) {
        throw new Error('LastfmInvalidSessionKey', { cause: error });
      } else {
        logger.error('Scrobble error:', error);
        throw new Error('LastfmRequestUnknownError', { cause: error });
      }
    }
  }

  async getUserInfo(sessionKey: string | undefined) {
    const params = new URLSearchParams();

    params.set('method', 'user.getinfo');
    params.set('sk', sessionKey || '');

    try {
      const response = await this._performRequest(params, 'get', true);

      return response?.data.user;
    } catch (error: unknown) {
      const errorCode = getLastfmErrorCode(error);
      if (errorCode === 9) {
        throw new Error('LastfmInvalidSessionKey', { cause: error });
      } else {
        logger.error('getUserInfo error:', error);
        throw new Error('LastfmRequestUnknownError', { cause: error });
      }
    }
  }

  async dispatchScrobbleFromQueue(scrobbleId: string) {
    const row = await findScrobble(this.db, scrobbleId);

    if (!row) {
      throw new Error('ScrobbleNotFound');
    }

    const track = trackSchema.parse(JSON.parse(row.track));
    const playbackData = playbackDataSchema.parse(
      JSON.parse(row.playback_data),
    );

    const failedUserIds = await this.dispatchScrobble(track, playbackData);

    // If completely successful (or non-transient failures), delete the queue item.
    // If transient failures occurred, schedule exponential backoff retries or drop after max attempts.
    if (failedUserIds.length === 0) {
      await this.db
        .delete(scrobblesQueue)
        .where(eq(scrobblesQueue.id, scrobbleId));
    } else {
      const nextRetryCount = (playbackData.retryCount ?? 0) + 1;
      if (nextRetryCount > SCROBBLE_RETRY_MAX_ATTEMPTS) {
        logger.warn(
          `Dropping queued scrobble ${scrobbleId} after ${SCROBBLE_RETRY_MAX_ATTEMPTS} retry attempts`,
        );
        await this.db
          .delete(scrobblesQueue)
          .where(eq(scrobblesQueue.id, scrobbleId));
      } else {
        const backoffMs =
          SCROBBLE_RETRY_BASE_MS * Math.pow(2, nextRetryCount - 1);
        playbackData.listeningUsersId = failedUserIds;
        playbackData.retryCount = nextRetryCount;
        playbackData.nextRetryAt = Date.now() + backoffMs;
        await setPlaybackData(this.db, scrobbleId, playbackData);
      }
    }

    return scrobbleId;
  }

  /**
   * Re-dispatches queued scrobbles whose retry backoff elapsed, plus orphaned
   * entries left undispatched for more than 10 minutes.
   */
  async retryPendingScrobbles(limit = 20): Promise<number> {
    const nowMs = Date.now();
    const orphanCutoffSec =
      Math.floor(nowMs / 1000) - ORPHANED_SCROBBLE_AGE_SECONDS;
    let processed = 0;
    let cursor: { created_at: number; id: string } | undefined;
    while (processed < limit) {
      const rows = await this.db
        .select({
          id: scrobblesQueue.id,
          playback_data: scrobblesQueue.playback_data,
          created_at: scrobblesQueue.created_at,
        })
        .from(scrobblesQueue)
        .where(
          cursor
            ? or(
                gt(scrobblesQueue.created_at, cursor.created_at),
                and(
                  eq(scrobblesQueue.created_at, cursor.created_at),
                  gt(scrobblesQueue.id, cursor.id),
                ),
              )
            : undefined,
        )
        .orderBy(asc(scrobblesQueue.created_at), asc(scrobblesQueue.id))
        .limit(100);
      if (rows.length === 0) break;
      for (const row of rows) {
        cursor = { created_at: row.created_at, id: row.id };
        if (processed >= limit) break;
        let parsed: PlaybackData;
        try {
          parsed = playbackDataSchema.parse(JSON.parse(row.playback_data));
        } catch (error) {
          logger.warn(`Deleting malformed scrobble queue row ${row.id}`, error);
          await this.db
            .delete(scrobblesQueue)
            .where(eq(scrobblesQueue.id, row.id));
          continue;
        }

        const retryDue =
          parsed.nextRetryAt !== undefined && parsed.nextRetryAt <= nowMs;
        const orphaned =
          parsed.retryCount === undefined && row.created_at <= orphanCutoffSec;
        if (!retryDue && !orphaned) continue;

        try {
          await this.dispatchScrobbleFromQueue(row.id);
          processed += 1;
        } catch (error) {
          logger.warn(`Failed retrying queued scrobble ${row.id}`, error);
        }
      }
      if (rows.length < 100) break;
    }

    return processed;
  }

  async addToScrobbleQueue(track: Track | null, playbackData: PlaybackData) {
    const thirtySecondsInMillis = 30000;
    const scrobblesOnUsers = [];

    if (!track || track.durationInMillis < thirtySecondsInMillis) {
      return;
    }

    const id = crypto.randomUUID();
    const createdAt = Math.floor(Date.now() / 1000);

    await this.db.insert(scrobblesQueue).values({
      id,
      track: JSON.stringify(track),
      playback_data: JSON.stringify(playbackData),
      created_at: createdAt,
    });

    for (const userId of playbackData.listeningUsersId) {
      const registeredUser = await findUser(this.db, userId);

      if (registeredUser?.scrobbles_on === true) {
        const sessionKey = this.resolveSessionToken(
          registeredUser.lastfm_session_token,
        );
        await this.updateNowPlaying(
          track,
          sessionKey ?? undefined,
          track.durationInMillis / 1000,
        );
        scrobblesOnUsers.push(userId);
      }
    }

    return {
      id,
      scrobblesOnUsers,
      track,
    };
  }

  async dispatchScrobble(
    track: Track,
    playbackData: PlaybackData,
  ): Promise<string[]> {
    const scrobblingRequestPromises: Promise<{
      userId: string;
      success: boolean;
      error?: Error;
    }>[] = [];

    for (const userId of playbackData.listeningUsersId) {
      const registeredUser = await findUser(this.db, userId);

      if (registeredUser?.scrobbles_on === true) {
        const sessionKey = this.resolveSessionToken(
          registeredUser.lastfm_session_token,
        );
        if (!sessionKey) {
          scrobblingRequestPromises.push(
            Promise.resolve({
              userId,
              success: false,
              error: new Error('LastfmInvalidSessionKey'),
            }),
          );
          continue;
        }
        const scrobblingRequestPromise = this.scrobble(
          [track],
          [playbackData],
          sessionKey,
        )
          .then(() => ({ userId, success: true }))
          .catch((error) => ({ userId, success: false, error }));
        scrobblingRequestPromises.push(scrobblingRequestPromise);
      }
    }

    const results = await Promise.all(scrobblingRequestPromises);
    const failedUserIds: string[] = [];

    for (const res of results) {
      if (!res.success) {
        if (res.error?.message === 'LastfmInvalidSessionKey') {
          logger.warn(`User ${res.userId} has invalid Last.fm session`);
          await this.db
            .update(users)
            .set({ scrobbles_on: false })
            .where(eq(users.id, res.userId));
        } else {
          logger.warn(
            `Transient scrobble error for ${res.userId}: ${res.error?.message || res.error}`,
          );
          failedUserIds.push(res.userId);
        }
      }
    }

    return failedUserIds;
  }

  async updateNowPlaying(
    track: Track,
    sessionKey: string | undefined,
    durationInSeconds?: number,
  ) {
    const params = new URLSearchParams();

    params.set('method', 'track.updatenowplaying');
    params.set('sk', sessionKey || '');

    params.set(`artist`, track.artist);
    params.set(`track`, track.name);
    if (track.album) {
      params.set(`album`, track.album);
    }
    if (durationInSeconds) {
      params.set(`duration`, durationInSeconds.toString());
    }

    try {
      await this._performRequest(params, 'post', true);
    } catch (error: unknown) {
      const errorCode = getLastfmErrorCode(error);
      if (errorCode !== 9) {
        logger.warn('updateNowPlaying failed:', error);
      }
    }
  }

  async getTopArtists(
    userName: string | null,
    period: LastfmTopListenedPeriod,
  ): Promise<{ name: string }[]> {
    const params = new URLSearchParams();

    params.set('method', 'user.gettopartists');
    params.set('user', userName || '');
    params.set('period', period);
    params.set('limit', '20');

    try {
      const response = await this._performRequest(params, 'get', false);

      const topArtists = response?.data.topartists;

      return (topArtists.artist as { name: string }[]).map((artist) => ({
        name: artist.name,
      }));
    } catch (error: unknown) {
      logger.error('getTopArtists error:', error);
      throw new Error('LastfmRequestUnknownError', { cause: error });
    }
  }

  async getTopAlbums(
    userName: string | null,
    period: LastfmTopListenedPeriod,
  ): Promise<{ name: string; artist: string }[]> {
    const params = new URLSearchParams();

    params.set('method', 'user.gettopalbums');
    params.set('user', userName || '');
    params.set('period', period);
    params.set('limit', '20');

    try {
      const response = await this._performRequest(params, 'get', false);

      const topAlbums = response?.data.topalbums;

      return (
        topAlbums.album as { name: string; artist: { name: string } }[]
      ).map((album) => ({
        name: album.name,
        artist: album.artist.name,
      }));
    } catch (error: unknown) {
      logger.error('getTopAlbums error:', error);
      throw new Error('LastfmRequestUnknownError', { cause: error });
    }
  }

  async getTopTracks(
    userName: string | null,
    period: LastfmTopListenedPeriod,
  ): Promise<{ name: string; artist: string }[]> {
    const params = new URLSearchParams();

    params.set('method', 'user.gettoptracks');
    params.set('user', userName || '');
    params.set('period', period);
    params.set('limit', '20');

    try {
      const response = await this._performRequest(params, 'get', false);

      const topTracks = response?.data.toptracks;

      return (
        topTracks.track as { name: string; artist: { name: string } }[]
      ).map((track) => ({
        name: track.name,
        artist: track.artist.name,
      }));
    } catch (error: unknown) {
      logger.error('getTopTracks error:', error);
      throw new Error('LastfmRequestUnknownError', { cause: error });
    }
  }

  private _performRequest(
    params: URLSearchParams,
    type: 'get' | 'post',
    signed: boolean,
  ) {
    params.set('api_key', this.config.lastfmApiKey || '');
    params.set('format', 'json');

    if (signed) {
      if (type === 'post' && !params.has('sk')) {
        throw new Error('SessionKeyNotProvidedOnRequest');
      }
      params.set('api_sig', this._getCallSignature(params));
    }
    const url = `${this.apiRootUrl}/?${params.toString()}`;

    if (type === 'get') {
      return axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: LASTFM_REQUEST_TIMEOUT_MS,
      });
    }

    if (type === 'post') {
      return axios.post(url, null, {
        headers: { 'User-Agent': this.userAgent },
        timeout: LASTFM_REQUEST_TIMEOUT_MS,
      });
    }
  }

  private _getCallSignature(params: URLSearchParams) {
    // Based on the implementation of https://github.com/jammus/lastfm-node/blob/master/lib/lastfm/lastfm-request.js
    let signatureString = '';

    params.sort();

    for (const [key, value] of params) {
      if (key !== 'format') {
        const copiedValue =
          typeof value !== 'undefined' && value !== null ? value : '';
        signatureString += key + copiedValue;
      }
    }

    signatureString += this.config.lastfmSharedSecret;
    return crypto.createHash('md5').update(signatureString).digest('hex');
  }

  getAuthorizationUrl = () => {
    return `https://www.last.fm/api/auth/?api_key=${this.config.lastfmApiKey}&cb=${this.config.lastfmRedirectUri}`;
  };

  async removeUserFromScrobble(scrobbleId: string, userId: string) {
    await this.db.transaction(async (tx) => {
      const row = await findScrobble(tx, scrobbleId, RowLock.ForUpdate);

      if (!row) {
        throw new Error('ScrobbleNotFound');
      }

      const playbackData = playbackDataSchema.parse(
        JSON.parse(row.playback_data),
      );
      const updatedUsers = playbackData.listeningUsersId.filter(
        (user) => user !== userId,
      );

      if (updatedUsers.length === 0) {
        await tx
          .delete(scrobblesQueue)
          .where(eq(scrobblesQueue.id, scrobbleId));
      } else {
        await setPlaybackData(tx, scrobbleId, {
          ...playbackData,
          listeningUsersId: updatedUsers,
        });
      }
    });

    return scrobbleId;
  }

  async addUserToScrobble(scrobbleId: string, userId: string) {
    const user = await findUser(this.db, userId);

    if (!user) {
      throw new Error('UserNotFound');
    }

    await this.db.transaction(async (tx) => {
      const row = await findScrobble(tx, scrobbleId, RowLock.ForUpdate);

      if (!row) {
        throw new Error('ScrobbleNotFound');
      }

      const playbackData = playbackDataSchema.parse(
        JSON.parse(row.playback_data),
      );

      if (playbackData.listeningUsersId.includes(userId)) {
        throw new Error('UserAlreadyOnScrobble');
      }

      playbackData.listeningUsersId.push(userId);
      await setPlaybackData(tx, scrobbleId, playbackData);
    });

    return scrobbleId;
  }
}
