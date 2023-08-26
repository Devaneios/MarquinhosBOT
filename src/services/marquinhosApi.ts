import axios, { AxiosInstance } from 'axios';
import { PlaybackData, Track } from 'src/types';

export class MarquinhosApiService {
  axios: AxiosInstance;

  constructor() {
    this.axios = axios.create({
      baseURL: `${process.env.MARQUINHOS_API_URL}/api/`,
    });
  }

  async addToScrobbleQueue(playbackData: PlaybackData) {
    try {
      const response = await this.axios.post('/scrobble/queue', {
        playbackData,
      });
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async dispatchScrobbleQueue(id: string) {
    try {
      const { data } = await this.axios.post(`/scrobble/${id}`);
      return data;
    } catch (error) {
      console.log(error);
      return null;
    }
  }
}
