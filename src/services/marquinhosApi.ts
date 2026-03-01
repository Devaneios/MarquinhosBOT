import { LastfmTopListenedPeriod, PlaybackData } from '@marquinhos/types';
import { HttpClient } from '@marquinhos/utils/httpClient';
import { logger } from '@marquinhos/utils/logger';

export class MarquinhosApiService {
  private client: HttpClient;

  constructor() {
    this.client = new HttpClient({
      baseURL: process.env.MARQUINHOS_API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
      retries: 3,
    });

    this.client.interceptors.request.use((config) => {
      if (process.env.MARQUINHOS_API_KEY) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
        };
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        const errorMsg = error.response?.data?.message || error.message;
        logger.error(`API Error on ${error.config?.url}: ${errorMsg}`);
        throw error;
      },
    );
  }

  async addToScrobbleQueue(scrobble: PlaybackData) {
    const data = await this.client.post('/api/scrobble/queue', {
      playbackData: scrobble,
    });
    return data;
  }

  async dispatchScrobbleQueue(id: string) {
    const data = await this.client.post(`/api/scrobble/${id}`);
    return data;
  }

  async removeUserFromScrobbleQueue(id: string, userId: string) {
    const data = await this.client.delete(`/api/scrobble/${id}/${userId}`);
    return data;
  }

  async addUserToScrobbleQueue(id: string, userId: string) {
    const data = await this.client.post(`/api/scrobble/${id}/${userId}`);
    return data;
  }

  async getTopArtists(id: string, period: LastfmTopListenedPeriod) {
    const data = await this.client.get(`/api/user/top-artists/${period}/${id}`);
    return data;
  }

  async getTopAlbums(id: string, period: LastfmTopListenedPeriod) {
    const data = await this.client.get(`/api/user/top-albums/${period}/${id}`);
    return data;
  }

  async getTopTracks(id: string, period: LastfmTopListenedPeriod) {
    const data = await this.client.get(`/api/user/top-tracks/${period}/${id}`);
    return data;
  }

  // Gamification API calls
  async addXP(userId: string, guildId: string, amount: number) {
    const data = await this.client.post('/api/gamification/xp', {
      userId,
      guildId,
      amount,
    });
    return data;
  }

  async getUserLevel(userId: string, guildId: string) {
    const data = await this.client.get(
      `/api/gamification/level/${userId}/${guildId}`,
    );
    return data;
  }

  async getLeaderboard(guildId: string, limit: number = 10) {
    const data = await this.client.get(
      `/api/gamification/leaderboard/${guildId}?limit=${limit}`,
    );
    return data;
  }

  async getUserAchievements(userId: string, guildId: string) {
    const data = await this.client.get(
      `/api/gamification/achievements/${userId}/${guildId}`,
    );
    return data;
  }

  async unlockAchievement(
    userId: string,
    guildId: string,
    achievementId: string,
  ) {
    const data = await this.client.post(
      '/api/gamification/achievement/unlock',
      { userId, guildId, achievementId },
    );
    return data;
  }

  // Playlist API calls
  async createPlaylist(
    name: string,
    description: string,
    creatorId: string,
    guildId: string,
    isCollaborative: boolean = false,
  ) {
    const data = await this.client.post('/api/playlist', {
      name,
      description,
      creatorId,
      guildId,
      isCollaborative,
    });
    return data;
  }

  async getPlaylist(playlistId: string) {
    const data = await this.client.get(`/api/playlist/${playlistId}`);
    return data;
  }

  async getUserPlaylists(userId: string, guildId: string) {
    const data = await this.client.get(
      `/api/playlist/user/${userId}/${guildId}`,
    );
    return data;
  }

  async addTrackToPlaylist(
    playlistId: string,
    userId: string,
    track: Record<string, unknown>,
  ) {
    const data = await this.client.post(`/api/playlist/${playlistId}/tracks`, {
      userId,
      track,
    });
    return data;
  }

  // Voice AI API calls
  async post(endpoint: string, payload: Record<string, unknown>) {
    const data = await this.client.post(endpoint, payload);
    return data;
  }

  async get(endpoint: string) {
    const data = await this.client.get(endpoint);
    return data;
  }

  async put(endpoint: string, payload: Record<string, unknown>) {
    const data = await this.client.put(endpoint, payload);
    return data;
  }
}
