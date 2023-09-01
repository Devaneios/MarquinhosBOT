import axios from 'axios';
import { PlaybackData, Track } from 'src/types';

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
      console.log(error);
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
      console.log(error);
      return null;
    }
  }

  async getTopArtists(id: string) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}/api/user/top-artists/${id}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async getTopAlbums(id: string) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}/api/user/top-albums/${id}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      console.log(error);
      return null;
    }
  }
}
