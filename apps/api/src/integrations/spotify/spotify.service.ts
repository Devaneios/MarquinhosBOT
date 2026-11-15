import type { Track } from '@marquinhos/contracts/http/routes/scrobble';
import { Injectable } from '@nestjs/common';
import { AppConfig } from 'config/app.config';
import SpotifyWebApi from 'spotify-web-api-node';

const SPOTIFY_TIMEOUT_MS = 10_000;

@Injectable()
export class SpotifyService {
  private readonly spotifyApi: SpotifyWebApi;
  private tokenExpiresAt = 0;
  private tokenPromise: Promise<void> | null = null;

  constructor(config: AppConfig) {
    this.spotifyApi = new SpotifyWebApi({
      clientId: config.spotifyClientId,
      clientSecret: config.spotifyClientSecret,
    });
  }

  private async withTimeout<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`SpotifyTimeout:${operation}`)),
            SPOTIFY_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async getTrack(trackId: string) {
    try {
      await this._getAccessToken();
      const track = await this.withTimeout('getTrack', () =>
        this.spotifyApi.getTrack(trackId),
      );
      const artist = track.body.artists[0];
      const coverArt = track.body.album.images[0];

      if (!artist || !coverArt) {
        throw new Error('SpotifyRequestUnknownError');
      }

      return {
        artist: artist.name,
        name: track.body.name,
        durationInMillis: track.body.duration_ms,
        album: track.body.album.name,
        coverArtUrl: coverArt.url,
      };
    } catch (error) {
      console.error(error);

      throw new Error('SpotifyRequestUnknownError', { cause: error });
    }
  }

  async searchTrack(query: string, trackPayload: 'full'): Promise<Track>;
  async searchTrack(
    query: string,
    trackPayload: 'minimal',
  ): Promise<Pick<Track, 'name' | 'coverArtUrl'>>;
  async searchTrack(
    query: string,
    trackPayload: 'full' | 'minimal',
  ): Promise<Track | Pick<Track, 'name' | 'coverArtUrl'>> {
    try {
      await this._getAccessToken();
      const track = await this.withTimeout('searchTracks', () =>
        this.spotifyApi.searchTracks(query, {
          limit: 1,
        }),
      );

      const item = track.body.tracks?.items[0];

      if (!item) {
        throw new Error('SpotifyTrackNotFound');
      }

      if (trackPayload === 'minimal') {
        return {
          name: item.name,
          coverArtUrl: item.album.images[0]?.url,
        };
      } else {
        const artist = item.artists[0];
        const coverArt = item.album.images[0];

        if (!artist || !coverArt) {
          throw new Error('SpotifyTrackNotFound');
        }

        return {
          artist: artist.name,
          name: item.name,
          durationInMillis: item.duration_ms,
          album: item.album.name,
          coverArtUrl: coverArt.url,
        };
      }
    } catch (error) {
      console.error(error);
      throw new Error('SpotifyRequestUnknownError', { cause: error });
    }
  }

  async searchArtist(
    query: string,
  ): Promise<{ name: string; coverArtUrl?: string } | null> {
    try {
      await this._getAccessToken();
      const artist = await this.withTimeout('searchArtist', () =>
        this.spotifyApi.search(query, ['artist'], {
          limit: 1,
        }),
      );

      const item = artist.body.artists?.items[0];

      if (!item) {
        throw new Error('SpotifyArtistNotFound');
      }

      return {
        name: item.name,
        coverArtUrl: item.images[0]?.url,
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async searchAlbum(query: string) {
    try {
      await this._getAccessToken();
      const album = await this.withTimeout('searchAlbum', () =>
        this.spotifyApi.search(query, ['album'], {
          limit: 1,
        }),
      );

      const item = album.body.albums?.items[0];

      if (!item) {
        throw new Error('SpotifyAlbumNotFound');
      }

      return {
        name: item.name,
        coverArtUrl: item.images[0]?.url,
      };
    } catch (error) {
      console.error(error);
      throw new Error('SpotifyRequestUnknownError', { cause: error });
    }
  }

  private async _getAccessToken() {
    if (Date.now() < this.tokenExpiresAt) return;
    if (this.tokenPromise) {
      await this.tokenPromise;
      return;
    }
    this.tokenPromise = (async () => {
      const data = await this.withTimeout('clientCredentialsGrant', () =>
        this.spotifyApi.clientCredentialsGrant(),
      );
      this.spotifyApi.setAccessToken(data.body.access_token);
      const ttlSeconds = Math.max(1, (data.body.expires_in ?? 3600) - 60);
      this.tokenExpiresAt = Date.now() + ttlSeconds * 1000;
    })();
    try {
      await this.tokenPromise;
    } finally {
      this.tokenPromise = null;
    }
  }
}
