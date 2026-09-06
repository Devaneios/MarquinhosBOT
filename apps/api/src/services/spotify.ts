import dotenv from 'dotenv';
import SpotifyWebApi from 'spotify-web-api-node';
import type { Track } from 'types';

dotenv.config();

export class SpotifyService {
  spotifyApi: SpotifyWebApi;

  constructor() {
    this.spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });
  }

  async getTrack(trackId: string) {
    try {
      await this._getAccessToken();
      const track = await this.spotifyApi.getTrack(trackId);
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

  async searchTrack(
    query: string,
    trackPayload: 'full' | 'minimal',
  ): Promise<Track | Pick<Track, 'name' | 'coverArtUrl'>> {
    try {
      await this._getAccessToken();
      const track = await this.spotifyApi.searchTracks(query, {
        limit: 1,
      });

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
      const artist = await this.spotifyApi.search(query, ['artist'], {
        limit: 1,
      });

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
      const album = await this.spotifyApi.search(query, ['album'], {
        limit: 1,
      });

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
    const data = await this.spotifyApi.clientCredentialsGrant();
    this.spotifyApi.setAccessToken(data.body.access_token);
  }
}
