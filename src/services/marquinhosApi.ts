import axios from 'axios';
import { PlaybackData, Track } from 'src/types';

export class MarquinhosApiService {
  async addToScrobbleQueue(playbackData: PlaybackData) {
    const options = {
      method: 'POST',
      url: `${process.env.MARQUINHOS_API_URL}/api/scrobble/queue`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MARQUINHOS_API_TOKEN}`,
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
