import {
  AddXpResult,
  ApiError,
  ApiResponse,
  LastfmTopListenedPeriod,
  PlaybackData,
  Playlist,
  UserAchievement,
  UserLevel,
} from '@marquinhos/types';
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
        const apiError = error as ApiError;
        const errorMsg =
          apiError.response?.data || apiError.message || 'Unknown error';
        logger.error(`API Error on ${apiError.config?.url}: ${errorMsg}`);
        throw error;
      },
    );
  }

  async addToScrobbleQueue(scrobble: PlaybackData): Promise<ApiResponse> {
    const data = await this.client.post('/api/scrobble/queue', {
      playbackData: scrobble,
    });
    return data as ApiResponse;
  }

  async dispatchScrobbleQueue(id: string): Promise<ApiResponse> {
    const data = await this.client.post(`/api/scrobble/${id}`);
    return data as ApiResponse;
  }

  async removeUserFromScrobbleQueue(
    id: string,
    userId: string,
  ): Promise<ApiResponse> {
    const data = await this.client.delete(`/api/scrobble/${id}/${userId}`);
    return data as ApiResponse;
  }

  async addUserToScrobbleQueue(
    id: string,
    userId: string,
  ): Promise<ApiResponse> {
    const data = await this.client.post(`/api/scrobble/${id}/${userId}`);
    return data as ApiResponse;
  }

  async getTopArtists(
    id: string,
    period: LastfmTopListenedPeriod,
  ): Promise<ApiResponse> {
    const data = await this.client.get(`/api/user/top-artists/${period}/${id}`);
    return data as ApiResponse;
  }

  async getTopAlbums(
    id: string,
    period: LastfmTopListenedPeriod,
  ): Promise<ApiResponse> {
    const data = await this.client.get(`/api/user/top-albums/${period}/${id}`);
    return data as ApiResponse;
  }

  async getTopTracks(
    id: string,
    period: LastfmTopListenedPeriod,
  ): Promise<ApiResponse> {
    const data = await this.client.get(`/api/user/top-tracks/${period}/${id}`);
    return data as ApiResponse;
  }

  // Gamification API calls
  async addXP(
    userId: string,
    guildId: string,
    eventType: string,
  ): Promise<ApiResponse<AddXpResult>> {
    const data = await this.client.post('/api/gamification/xp', {
      userId,
      guildId,
      eventType,
    });
    return data as ApiResponse<AddXpResult>;
  }

  async postGameResult(payload: {
    sessionId: string;
    guildId: string;
    gameType: string;
    durationMs?: number;
    results: { userId: string; position: number }[];
  }): Promise<ApiResponse> {
    const data = await this.client.post(
      '/api/gamification/game-result',
      payload,
    );
    return data as ApiResponse;
  }

  async getUserGameStats(
    userId: string,
    guildId: string,
  ): Promise<ApiResponse> {
    const data = await this.client.get(
      `/api/gamification/game-stats/${userId}/${guildId}`,
    );
    return data as ApiResponse;
  }

  async getGameLeaderboard(
    guildId: string,
    gameType: string,
  ): Promise<ApiResponse> {
    const data = await this.client.get(
      `/api/gamification/game-leaderboard/${guildId}/${gameType}`,
    );
    return data as ApiResponse;
  }

  async getUserLevel(
    userId: string,
    guildId: string,
  ): Promise<ApiResponse<UserLevel>> {
    const data = await this.client.get(
      `/api/gamification/level/${userId}/${guildId}`,
    );
    return data as ApiResponse<UserLevel>;
  }

  async getLeaderboard(
    guildId: string,
    limit: number = 10,
  ): Promise<ApiResponse<UserLevel[]>> {
    const data = await this.client.get(
      `/api/gamification/leaderboard/${guildId}?limit=${limit}`,
    );
    return data as ApiResponse<UserLevel[]>;
  }

  async getUserAchievements(
    userId: string,
    guildId: string,
  ): Promise<ApiResponse<UserAchievement[]>> {
    const data = await this.client.get(
      `/api/gamification/achievements/${userId}/${guildId}`,
    );
    return data as ApiResponse<UserAchievement[]>;
  }

  async unlockAchievement(
    userId: string,
    guildId: string,
    achievementId: string,
  ): Promise<ApiResponse<UserAchievement>> {
    const data = await this.client.post(
      '/api/gamification/achievement/unlock',
      { userId, guildId, achievementId },
    );
    return data as ApiResponse<UserAchievement>;
  }

  // Playlist API calls
  async createPlaylist(
    name: string,
    description: string,
    creatorId: string,
    guildId: string,
    isCollaborative: boolean = false,
  ): Promise<ApiResponse<Playlist>> {
    const data = await this.client.post('/api/playlist', {
      name,
      description,
      creatorId,
      guildId,
      isCollaborative,
    });
    return data as ApiResponse<Playlist>;
  }

  async getPlaylist(playlistId: string): Promise<ApiResponse<Playlist>> {
    const data = await this.client.get(`/api/playlist/${playlistId}`);
    return data as ApiResponse<Playlist>;
  }

  async getUserPlaylists(
    userId: string,
    guildId: string,
  ): Promise<ApiResponse<Playlist[]>> {
    const data = await this.client.get(
      `/api/playlist/user/${userId}/${guildId}`,
    );
    return data as ApiResponse<Playlist[]>;
  }

  async addTrackToPlaylist(
    playlistId: string,
    userId: string,
    track: Record<string, unknown>,
  ): Promise<ApiResponse<Playlist>> {
    const data = await this.client.post(`/api/playlist/${playlistId}/tracks`, {
      userId,
      track,
    });
    return data as ApiResponse<Playlist>;
  }

  // Voice AI API calls
  async post(
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const data = await this.client.post(endpoint, payload);
    return data as ApiResponse;
  }

  async get(endpoint: string): Promise<ApiResponse> {
    const data = await this.client.get(endpoint);
    return data as ApiResponse;
  }

  async put(
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const data = await this.client.put(endpoint, payload);
    return data as ApiResponse;
  }
}
