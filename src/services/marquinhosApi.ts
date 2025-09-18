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

  // Gamification API calls
  async addXP(userId: string, guildId: string, amount: number) {
    const options = {
      method: 'POST',
      url: `${process.env.MARQUINHOS_API_URL}/api/gamification/xp`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
      data: { userId, guildId, amount },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to add XP for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getUserLevel(userId: string, guildId: string) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}/api/gamification/level/${userId}/${guildId}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to get user level for ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getLeaderboard(guildId: string, limit: number = 10) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}/api/gamification/leaderboard/${guildId}?limit=${limit}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to get leaderboard for guild ${guildId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getUserAchievements(userId: string, guildId: string) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}/api/gamification/achievements/${userId}/${guildId}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to get achievements for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async unlockAchievement(userId: string, guildId: string, achievementId: string) {
    const options = {
      method: 'POST',
      url: `${process.env.MARQUINHOS_API_URL}/api/gamification/achievement/unlock`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
      data: { userId, guildId, achievementId },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to unlock achievement ${achievementId} for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Playlist API calls
  async createPlaylist(name: string, description: string, creatorId: string, guildId: string, isCollaborative: boolean = false) {
    const options = {
      method: 'POST',
      url: `${process.env.MARQUINHOS_API_URL}/api/playlist`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
      data: { name, description, creatorId, guildId, isCollaborative },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to create playlist: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getPlaylist(playlistId: string) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}/api/playlist/${playlistId}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to get playlist ${playlistId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getUserPlaylists(userId: string, guildId: string) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}/api/playlist/user/${userId}/${guildId}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to get user playlists for ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async addTrackToPlaylist(playlistId: string, userId: string, track: any) {
    const options = {
      method: 'POST',
      url: `${process.env.MARQUINHOS_API_URL}/api/playlist/${playlistId}/tracks`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
      data: { userId, track },
    };
    try {
      const { data } = await axios.request(options);
      return data;
    } catch (error) {
      logger.error(
        `Failed to add track to playlist ${playlistId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // Voice AI API calls
  async post(endpoint: string, data: any) {
    const options = {
      method: 'POST',
      url: `${process.env.MARQUINHOS_API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
      data,
    };
    try {
      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      logger.error(`Failed to POST to ${endpoint}: ${(error as Error).message}`);
      throw error;
    }
  }

  async get(endpoint: string) {
    const options = {
      method: 'GET',
      url: `${process.env.MARQUINHOS_API_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
    };
    try {
      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      logger.error(`Failed to GET from ${endpoint}: ${(error as Error).message}`);
      throw error;
    }
  }

  async put(endpoint: string, data: any) {
    const options = {
      method: 'PUT',
      url: `${process.env.MARQUINHOS_API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
      },
      data,
    };
    try {
      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      logger.error(`Failed to PUT to ${endpoint}: ${(error as Error).message}`);
      throw error;
    }
  }
}
