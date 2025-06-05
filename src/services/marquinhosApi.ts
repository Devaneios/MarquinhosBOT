import axios from 'axios';
import { LastfmTopListenedPeriod, PlaybackData } from '@marquinhos/types';
import { logger } from '@marquinhos/utils/logger';

export class MarquinhosApiService {
  async addToScrobbleQueue(scrobble: PlaybackData) {
    const options = {
      method: 'POST',
      url: `${process.env.MARQUINHOS_API_URL}/api/scrobble/queue`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
      data: {
        playbackData: scrobble,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to add playback data to scrobble queue: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async dispatchScrobbleQueue(id: string) {
    const options = {
      method: 'POST',
      url: `${process.env.MARQUINHOS_API_URL}/api/scrobble/${id}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to dispatch scrobble queue for ID ${id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async removeUserFromScrobbleQueue(id: string, userId: string) {
    const options = {
      method: 'DELETE',
      url: `${process.env.MARQUINHOS_API_URL}/api/scrobble/${id}/${userId}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to remove user ${userId} from scrobble queue for ID ${id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async addUserToScrobbleQueue(id: string, userId: string) {
    const options = {
      method: 'POST',
      url: `${process.env.MARQUINHOS_API_URL}/api/scrobble/${id}/${userId}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to add user ${userId} to scrobble queue for ID ${id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getTopArtists(id: string, period: LastfmTopListenedPeriod) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}/api/user/top-artists/${period}/${id}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to get top artists for user ID ${id} with period ${period}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getTopAlbums(id: string, period: LastfmTopListenedPeriod) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}/api/user/top-albums/${period}/${id}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to get top albums for user ID ${id} with period ${period}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getTopTracks(id: string, period: LastfmTopListenedPeriod) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}/api/user/top-tracks/${period}/${id}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to get top tracks for user ID ${id} with period ${period}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
