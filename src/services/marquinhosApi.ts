import { LastfmTopListenedPeriod, PlaybackData } from '@marquinhos/types';
import axios from 'axios';

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
      throw error;
    }
  }
}
