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

import axios from 'axios';
import crypto from 'crypto';
import { db } from 'database/sqlite';
import { getUnixTime, parseISO } from 'date-fns';
import type {
  LastfmSessionResponse,
  LastfmTopListenedPeriod,
  PlaybackData,
  Track,
} from 'types';
import { URLSearchParams } from 'url';
// URLSearchParams is available globally in Node.js >= 15 but we import for clarity

const logger = {
  error: (...args: unknown[]) => console.error('[lastfm]', ...args),
  warn: (...args: unknown[]) => console.warn('[lastfm]', ...args),
};

interface LastfmErrorResponse {
  response?: {
    data?: {
      error?: number;
    };
  };
}

type ScrobbleRow = {
  id: string;
  track: string;
  playback_data: string;
};

type UserRow = {
  id: string;
  lastfm_session_token: string | null;
  scrobbles_on: number | null;
};

export class LastfmService {
  readonly apiRootUrl = 'https://ws.audioscrobbler.com/2.0';
  readonly userAgent = 'cordscrobbler/1.0.0';

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
      const err = error as LastfmErrorResponse;
      if (err?.response?.data?.error === 14) {
        throw new Error('LastfmTokenNotAuthorized', { cause: error });
      }
      if (
        err?.response?.data?.error === 11 ||
        err?.response?.data?.error === 16
      ) {
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
        getUnixTime(parseISO(playbackData.timestamp.toString())).toString(),
      );
      if (track.album) {
        params.set(`album[${i}]`, track.album);
      }
    }

    try {
      await this._performRequest(params, 'post', true);
    } catch (error: unknown) {
      const err = error as LastfmErrorResponse;
      if (err?.response?.data?.error === 9) {
        throw new Error('LastfmInvalidSessionKey', { cause: error });
      } else {
        logger.error('Scrobble error:', error);
        throw new Error('LastfmRequestUnknownError', { cause: error });
      }
    }
    // TODO: Check scrobble history/queue on fail
  }

  async getUserInfo(sessionKey: string | undefined) {
    const params = new URLSearchParams();

    params.set('method', 'user.getinfo');
    params.set('sk', sessionKey || '');

    try {
      const response = await this._performRequest(params, 'get', true);

      return response?.data.user;
    } catch (error: unknown) {
      const err = error as LastfmErrorResponse;
      if (err?.response?.data?.error === 9) {
        throw new Error('LastfmInvalidSessionKey', { cause: error });
      } else {
        logger.error('getUserInfo error:', error);
        throw new Error('LastfmRequestUnknownError', { cause: error });
      }
    }
  }

  async dispatchScrobbleFromQueue(scrobbleId: string) {
    const row = db
      .prepare('SELECT track, playback_data FROM scrobbles_queue WHERE id = ?')
      .get(scrobbleId) as Pick<ScrobbleRow, 'track' | 'playback_data'> | null;

    if (!row) {
      throw new Error('ScrobbleNotFound');
    }

    const track = JSON.parse(row.track) as Track;
    const playbackData = JSON.parse(row.playback_data) as PlaybackData;

    const failedUserIds = await this.dispatchScrobble(track, playbackData);

    // If completely successful (or non-transient failures), delete the queue item.
    // If transient failures occurred, update the queue to only contain the users who need retries.
    if (failedUserIds.length === 0) {
      db.prepare('DELETE FROM scrobbles_queue WHERE id = ?').run(scrobbleId);
    } else {
      playbackData.listeningUsersId = failedUserIds;
      db.prepare(
        'UPDATE scrobbles_queue SET playback_data = ? WHERE id = ?',
      ).run(JSON.stringify(playbackData), scrobbleId);
    }

    return scrobbleId;
  }

  async addToScrobbleQueue(track: Track | null, playbackData: PlaybackData) {
    const thirtySecondsInMillis = 30000;
    const scrobblesOnUsers = [];

    if (!track || track.durationInMillis < thirtySecondsInMillis) {
      return;
    }

    const id = crypto.randomUUID();
    const createdAt = Math.floor(Date.now() / 1000);

    db.prepare(
      'INSERT INTO scrobbles_queue (id, track, playback_data, created_at) VALUES (?, ?, ?, ?)',
    ).run(id, JSON.stringify(track), JSON.stringify(playbackData), createdAt);

    for (const userId of playbackData.listeningUsersId) {
      const registeredUser = db
        .prepare(
          'SELECT lastfm_session_token, scrobbles_on FROM users WHERE id = ?',
        )
        .get(userId) as Pick<
        UserRow,
        'lastfm_session_token' | 'scrobbles_on'
      > | null;

      if (registeredUser?.scrobbles_on === 1) {
        await this.updateNowPlaying(
          track,
          registeredUser.lastfm_session_token ?? undefined,
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
      const registeredUser = db
        .prepare(
          'SELECT lastfm_session_token, scrobbles_on FROM users WHERE id = ?',
        )
        .get(userId) as Pick<
        UserRow,
        'lastfm_session_token' | 'scrobbles_on'
      > | null;

      if (registeredUser?.scrobbles_on === 1) {
        const scrobblingRequestPromise = this.scrobble(
          [track],
          [playbackData],
          registeredUser.lastfm_session_token ?? undefined,
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
          db.prepare('UPDATE users SET scrobbles_on = 0 WHERE id = ?').run(
            res.userId,
          );
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
      const err = error as LastfmErrorResponse;
      if (err?.response?.data?.error !== 9) {
        logger.warn('updateNowPlaying failed:', error);
      }
    }
  }

  async getTopArtists(
    userName: string | null,
    period: LastfmTopListenedPeriod,
  ) {
    const params = new URLSearchParams();

    params.set('method', 'user.gettopartists');
    params.set('user', userName || '');
    params.set('period', period);
    params.set('limit', '20');

    try {
      const response = await this._performRequest(params, 'get', false);

      const topArtists = response?.data.topartists;

      return topArtists.artist.map((artist: { name: string }) => {
        return {
          name: artist.name,
        };
      });
    } catch (error: unknown) {
      logger.error('getTopArtists error:', error);
      throw new Error('LastfmRequestUnknownError', { cause: error });
    }
  }

  async getTopAlbums(userName: string | null, period: LastfmTopListenedPeriod) {
    const params = new URLSearchParams();

    params.set('method', 'user.gettopalbums');
    params.set('user', userName || '');
    params.set('period', period);
    params.set('limit', '20');

    try {
      const response = await this._performRequest(params, 'get', false);

      const topAlbums = response?.data.topalbums;

      return topAlbums.album.map(
        (album: { name: string; artist: { name: string } }) => {
          return {
            name: album.name,
            artist: album.artist.name,
          };
        },
      );
    } catch (error: unknown) {
      logger.error('getTopAlbums error:', error);
      throw new Error('LastfmRequestUnknownError', { cause: error });
    }
  }

  async getTopTracks(userName: string | null, period: LastfmTopListenedPeriod) {
    const params = new URLSearchParams();

    params.set('method', 'user.gettoptracks');
    params.set('user', userName || '');
    params.set('period', period);
    params.set('limit', '20');

    try {
      const response = await this._performRequest(params, 'get', false);

      const topTracks = response?.data.toptracks;

      return topTracks.track.map(
        (track: { name: string; artist: { name: string } }) => {
          return {
            name: track.name,
            artist: track.artist.name,
          };
        },
      );
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
    params.set('api_key', process.env.LASTFM_API_KEY || '');
    params.set('format', 'json');

    if (signed) {
      if (type === 'post' && !params.has('sk')) {
        throw new Error('SessionKeyNotProvidedOnRequest');
      }
      params.set('api_sig', this._getCallSignature(params));
    }
    const url = `${this.apiRootUrl}/?${params.toString()}`;

    if (type === 'get') {
      return axios.get(url, { headers: { 'User-Agent': this.userAgent } });
    }

    if (type === 'post') {
      return axios.post(url, null, {
        headers: { 'User-Agent': this.userAgent },
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

    signatureString += process.env.LASTFM_SHARED_SECRET;
    return crypto.createHash('md5').update(signatureString).digest('hex');
  }

  getAuthorizationUrl = () => {
    return `https://www.last.fm/api/auth/?api_key=${process.env.LASTFM_API_KEY}&cb=${process.env.LASTFM_REDIRECT_URI}`;
  };

  async removeUserFromScrobble(scrobbleId: string, userId: string) {
    const row = db
      .prepare('SELECT playback_data FROM scrobbles_queue WHERE id = ?')
      .get(scrobbleId) as Pick<ScrobbleRow, 'playback_data'> | null;

    if (!row) {
      throw new Error('ScrobbleNotFound');
    }

    const playbackData = JSON.parse(row.playback_data) as PlaybackData;
    const updatedUsers = playbackData.listeningUsersId.filter(
      (user) => user !== userId,
    );

    if (updatedUsers.length === 0) {
      db.prepare('DELETE FROM scrobbles_queue WHERE id = ?').run(scrobbleId);
    } else {
      const newPlaybackData: PlaybackData = {
        ...playbackData,
        listeningUsersId: updatedUsers,
      };
      db.prepare(
        'UPDATE scrobbles_queue SET playback_data = ? WHERE id = ?',
      ).run(JSON.stringify(newPlaybackData), scrobbleId);
    }

    return scrobbleId;
  }

  async addUserToScrobble(scrobbleId: string, userId: string) {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);

    if (!user) {
      throw new Error('UserNotFound');
    }

    const row = db
      .prepare('SELECT playback_data FROM scrobbles_queue WHERE id = ?')
      .get(scrobbleId) as Pick<ScrobbleRow, 'playback_data'> | null;

    if (!row) {
      throw new Error('ScrobbleNotFound');
    }

    const playbackData = JSON.parse(row.playback_data) as PlaybackData;

    if (playbackData.listeningUsersId.includes(userId)) {
      throw new Error('UserAlreadyOnScrobble');
    }

    playbackData.listeningUsersId.push(userId);

    db.prepare('UPDATE scrobbles_queue SET playback_data = ? WHERE id = ?').run(
      JSON.stringify(playbackData),
      scrobbleId,
    );

    return scrobbleId;
  }
}
