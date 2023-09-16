import axios from 'axios';
import { LastfmTopListenedPeriod, PlaybackData, Track } from 'src/types';

export class MarquinhosApiService {
  async addToScrobbleQueue(playbackData: PlaybackData) {
    const options = {
      method: 'POST',
      url: `${process.env.MARQUINHOS_API_URL}/api/scrobble/queue`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
      data: {
        playbackData,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      throw new Error('Error adding to scrobble queue');
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
      throw new Error('Error dispatching scrobble');
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
      throw new Error('Error removing user from scrobble queue');
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
      throw new Error('Error getting top artists');
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
      throw new Error('Error getting top albums');
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
      throw new Error('Error getting top tracks');
    }
  }
}
