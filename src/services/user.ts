import { db } from 'database/sqlite';
import dotenv from 'dotenv';
import { DiscordService } from 'services/discord';
import { LastfmService } from 'services/lastfm';
import { SpotifyService } from 'services/spotify';
import type { LastfmTopListenedPeriod, Track } from 'types';
import { decryptToken, encryptToken } from 'utils/crypto';

dotenv.config();

type UserRow = {
  id: string;
  lastfm_session_token: string | null;
  lastfm_username: string | null;
  scrobbles_on: number | null;
};

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
    db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(id);
    return { id };
  }

  async enableLastfm(id: string, token: string) {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);

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
    db.prepare(
      'UPDATE users SET lastfm_session_token = ?, lastfm_username = ?, scrobbles_on = 1 WHERE id = ?',
    ).run(encrypted, sessionToken.userName, id);

    return { id };
  }

  async deleteLastfmData(id: string) {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);

    if (!user) {
      throw new Error('User not found');
    }

    db.prepare(
      'UPDATE users SET lastfm_session_token = NULL, lastfm_username = NULL, scrobbles_on = NULL WHERE id = ?',
    ).run(id);

    return { id };
  }

  async deleteAllData(id: string) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  async toggleScrobbles(id: string) {
    const row = db
      .prepare('SELECT scrobbles_on FROM users WHERE id = ?')
      .get(id) as Pick<UserRow, 'scrobbles_on'> | null;

    if (!row) {
      throw new Error('User not found');
    }

    const newValue = row.scrobbles_on ? 0 : 1;

    db.prepare('UPDATE users SET scrobbles_on = ? WHERE id = ?').run(
      newValue,
      id,
    );

    return { id, scrobblesOn: newValue === 1 };
  }

  async exists(id: string) {
    const row = db.prepare('SELECT id FROM users WHERE id = ?').get(id);

    if (!row) {
      return null;
    }

    return { id };
  }

  async hasValidLastfmSessionToken(id: string) {
    const row = db
      .prepare(
        'SELECT lastfm_session_token, scrobbles_on FROM users WHERE id = ?',
      )
      .get(id) as Pick<UserRow, 'lastfm_session_token' | 'scrobbles_on'> | null;

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

    return { id, scrobblesOn: row.scrobbles_on === 1 };
  }

  async getLastfmUsername(id: string) {
    const row = db
      .prepare('SELECT lastfm_username FROM users WHERE id = ?')
      .get(id) as Pick<UserRow, 'lastfm_username'> | null;

    if (!row) {
      throw new Error('User not found');
    }

    return row.lastfm_username ?? null;
  }

  async getTopArtists(id: string, period: LastfmTopListenedPeriod) {
    const row = db
      .prepare(
        'SELECT lastfm_username, lastfm_session_token FROM users WHERE id = ?',
      )
      .get(id) as Pick<
      UserRow,
      'lastfm_username' | 'lastfm_session_token'
    > | null;

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
    const row = db
      .prepare(
        'SELECT lastfm_username, lastfm_session_token FROM users WHERE id = ?',
      )
      .get(id) as Pick<
      UserRow,
      'lastfm_username' | 'lastfm_session_token'
    > | null;

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
    const row = db
      .prepare(
        'SELECT lastfm_username, lastfm_session_token FROM users WHERE id = ?',
      )
      .get(id) as Pick<
      UserRow,
      'lastfm_username' | 'lastfm_session_token'
    > | null;

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
