import { HttpClient, HttpError } from '@marquinhos/api-client/bot';
import { env } from '@marquinhos/config/environment';
import {
  addXpResultSchema,
  aiChatResponseSchema,
  apiResponseSchema,
  dailyLeaderboardEntrySchema,
  emojiReactionResponseSchema,
  forceNewWordResultSchema,
  gameLeaderboardEntrySchema,
  markWordleAnnouncedResultSchema,
  mazeViewportStateSchema,
  rankedLeaderboardEntrySchema,
  researchJobResponseSchema,
  researchStartResponseSchema,
  unannouncedWordleWinSchema,
  unlockAchievementResultSchema,
  userAchievementSchema,
  userGameStatsSchema,
  userLevelSchema,
  userWordleSessionSchema,
  validateWordleGuessResultSchema,
  wordleConfigSchema,
  wordleDailyStatsSchema,
  wordleDayGuessesSchema,
  wordleGuessResultSchema,
  wordleLeaderboardResultSchema,
  wordleReviewWordResultSchema,
  wordlistPoolStatsSchema,
  type DailyLeaderboardEntry,
  type RankedLeaderboardEntry,
} from '@marquinhos/contracts/http/botResponses';
import {
  AddXpResult,
  AiChatResponse,
  ApiResponse,
  EmojiReactionResponse,
  MazeViewportState,
  PlaybackData,
  ResearchJobResponse,
  ResearchStartResponse,
  UserAchievement,
  UserLevel,
} from '@marquinhos/types';
import { reportError } from '@marquinhos/utils/errorHandling';
import { logger } from '@marquinhos/utils/logger';
import { z } from 'zod';

function extractErrorMessage(data: unknown, fallback: string): unknown {
  if (
    data &&
    typeof data === 'object' &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return data.message;
  }
  return data ?? fallback;
}

export function handleApiResponseError(error: unknown): never {
  if (error instanceof HttpError) {
    const errorMsg = extractErrorMessage(error.response?.data, error.message);
    logger.error(`API Error on ${error.config?.url}: ${errorMsg}`);
    reportError(error, {
      origin: `API:${error.config?.url ?? 'unknown'}`,
      logLevel: 'warn',
    });
    throw error;
  }
  logger.error(`API Error: ${String(error)}`);
  reportError(error, { origin: 'API:unknown', logLevel: 'warn' });
  throw error;
}

export class MarquinhosApiService {
  private static instance: MarquinhosApiService;
  private client: HttpClient;
  private wordleConfigCache = new Map<string, string | null>();

  private constructor() {
    this.client = new HttpClient({
      baseURL: env.MARQUINHOS_API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
      retries: 3,
      onRetry: (message) => logger.warn(message),
    });

    this.client.interceptors.request.use((config) => {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${env.MARQUINHOS_API_KEY}`,
      };
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      handleApiResponseError,
    );
  }

  public static getInstance(): MarquinhosApiService {
    if (!MarquinhosApiService.instance) {
      MarquinhosApiService.instance = new MarquinhosApiService();
    }
    return MarquinhosApiService.instance;
  }

  async addToScrobbleQueue(scrobble: PlaybackData): Promise<ApiResponse> {
    const data = await this.client.post('/api/scrobble/queue', {
      playbackData: scrobble,
    });
    return apiResponseSchema(z.unknown()).parse(data);
  }

  async dispatchScrobbleQueue(id: string): Promise<ApiResponse> {
    const data = await this.client.post(`/api/scrobble/${id}`);
    return apiResponseSchema(z.unknown()).parse(data);
  }

  async removeUserFromScrobbleQueue(
    id: string,
    userId: string,
  ): Promise<ApiResponse> {
    const data = await this.client.delete(`/api/scrobble/${id}/${userId}`);
    return apiResponseSchema(z.unknown()).parse(data);
  }

  async addUserToScrobbleQueue(
    id: string,
    userId: string,
  ): Promise<ApiResponse> {
    const data = await this.client.post(`/api/scrobble/${id}/${userId}`);
    return apiResponseSchema(z.unknown()).parse(data);
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
    return apiResponseSchema(addXpResultSchema).parse(data);
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
    return apiResponseSchema(z.unknown()).parse(data);
  }

  async respondToTag(payload: {
    userId: string;
    guildId: string;
    channelId: string;
    content: string;
    recentMessages: { author: string; content: string }[];
    repliedMessage?: { author: string; content: string };
  }): Promise<ApiResponse<AiChatResponse>> {
    const startedAt = Date.now();
    const raw = await this.client.post('/api/ai-chat/respond', payload, {
      timeout: 120000,
    });
    const data = apiResponseSchema(aiChatResponseSchema).parse(raw);
    logger.info(
      `[ai-chat] respondToTag user=${payload.userId} status=${data.data?.status} category=${data.data?.category ?? '-'} trace=${data.data?.traceId ?? '-'} ${Date.now() - startedAt}ms`,
    );
    return data;
  }

  async askInThread(payload: {
    threadId: string;
    guildId: string;
    channelId: string;
    userId: string;
    content: string;
    mode?: 'ask' | 'research';
  }): Promise<ApiResponse<AiChatResponse>> {
    const startedAt = Date.now();
    const raw = await this.client.post('/api/ai-chat/thread/ask', payload, {
      timeout: 120000,
    });
    const data = apiResponseSchema(aiChatResponseSchema).parse(raw);
    logger.info(
      `[ai-chat] askInThread thread=${payload.threadId} status=${data.data?.status} trace=${data.data?.traceId ?? '-'} ${Date.now() - startedAt}ms`,
    );
    return data;
  }

  async startResearch(payload: {
    threadId: string;
    guildId: string;
    channelId: string;
    userId: string;
    query: string;
    idempotencyKey: string;
  }): Promise<ApiResponse<ResearchStartResponse>> {
    const raw = await this.client.post('/api/ai-chat/research', payload);
    const data = apiResponseSchema(researchStartResponseSchema).parse(raw);
    logger.info(
      `[ai-chat] startResearch thread=${payload.threadId} status=${data.data?.status} job=${data.data?.jobId ?? '-'}`,
    );
    return data;
  }

  async getResearchJob(
    jobId: string,
  ): Promise<ApiResponse<ResearchJobResponse>> {
    const data = await this.client.get(`/api/ai-chat/research/${jobId}`);
    return apiResponseSchema(researchJobResponseSchema).parse(data);
  }

  async chooseEmojiReactions(payload: {
    content: string;
    recentMessages?: { author: string; content: string }[];
  }): Promise<ApiResponse<EmojiReactionResponse>> {
    const data = await this.client.post('/api/emoji-reaction/choose', payload);
    return apiResponseSchema(emojiReactionResponseSchema).parse(data);
  }

  async getUserGameStats(
    userId: string,
    guildId: string,
  ): Promise<
    ApiResponse<{
      stats: {
        user_id: string;
        guild_id: string;
        total_commands: number;
        total_scrobbles: number;
        total_voice_joins: number;
        total_games: number;
        games_won: number;
      };
      byGame: { game_type: string; games_played: number; wins: number }[];
    }>
  > {
    const data = await this.client.get(
      `/api/gamification/game-stats/${userId}/${guildId}`,
    );
    return apiResponseSchema(userGameStatsSchema).parse(data);
  }

  async getGameLeaderboard(
    guildId: string,
    gameType: string,
  ): Promise<
    ApiResponse<
      {
        user_id: string;
        wins: number;
        games_played: number;
        total_xp_earned: number;
      }[]
    >
  > {
    const data = await this.client.get(
      `/api/gamification/game-leaderboard/${guildId}/${gameType}`,
    );
    return apiResponseSchema(z.array(gameLeaderboardEntrySchema)).parse(data);
  }

  async getUserLevel(
    userId: string,
    guildId: string,
  ): Promise<ApiResponse<UserLevel>> {
    const data = await this.client.get(
      `/api/gamification/level/${userId}/${guildId}`,
    );
    return apiResponseSchema(userLevelSchema).parse(data);
  }

  async getLeaderboard(
    guildId: string,
    limit: number = 10,
  ): Promise<ApiResponse<UserLevel[]>> {
    const data = await this.client.get(
      `/api/gamification/leaderboard/${guildId}?limit=${limit}`,
    );
    return apiResponseSchema(z.array(userLevelSchema)).parse(data);
  }

  async getUserAchievements(
    userId: string,
    guildId: string,
  ): Promise<ApiResponse<UserAchievement[]>> {
    const data = await this.client.get(
      `/api/gamification/achievements/${userId}/${guildId}`,
    );
    return apiResponseSchema(z.array(userAchievementSchema)).parse(data);
  }

  async unlockAchievement(
    userId: string,
    guildId: string,
    achievementId: string,
  ): Promise<ApiResponse<{ unlocked: boolean }>> {
    const data = await this.client.post(
      '/api/gamification/achievement/unlock',
      { userId, guildId, achievementId },
    );
    return apiResponseSchema(unlockAchievementResultSchema).parse(data);
  }

  // Maze Game API calls
  async startMaze(
    userId: string,
    guildId: string,
    mode: 'open' | 'foggy',
    size: number,
  ): Promise<MazeViewportState> {
    const data = await this.client.post('/api/games/maze/start', {
      userId,
      guildId,
      mode,
      size,
    });
    return apiResponseSchema(mazeViewportStateSchema).parse(data).data;
  }

  async moveMaze(
    sessionId: string,
    userId: string,
    direction: string,
  ): Promise<MazeViewportState> {
    const data = await this.client.post(`/api/games/maze/${sessionId}/move`, {
      userId,
      direction,
    });
    return apiResponseSchema(mazeViewportStateSchema).parse(data).data;
  }

  async getMazeState(sessionId: string): Promise<MazeViewportState | null> {
    try {
      const data = await this.client.get(`/api/games/maze/${sessionId}`);
      return apiResponseSchema(mazeViewportStateSchema).parse(data).data;
    } catch {
      return null;
    }
  }

  async abandonMaze(sessionId: string, userId: string): Promise<void> {
    await this.client.delete(`/api/games/maze/${sessionId}`, {
      body: JSON.stringify({ userId }),
    });
  }

  async recordActivityDeepLink(
    userId: string,
    guildId: string,
    game: string,
  ): Promise<ApiResponse> {
    const data = await this.client.post('/api/activities/deep-link', {
      userId,
      guildId,
      game,
    });
    return apiResponseSchema(z.unknown()).parse(data);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/api/health');
      return true;
    } catch {
      return false;
    }
  }

  // Wordle/Termo API calls
  async submitWordleGuess(
    userId: string,
    guildId: string,
    guess: string,
  ): Promise<ApiResponse<z.infer<typeof wordleGuessResultSchema>>> {
    const data = await this.client.post('/api/wordle/guess', {
      userId,
      guildId,
      guess,
    });
    return apiResponseSchema(wordleGuessResultSchema).parse(data);
  }

  async getWordleStats(
    guildId: string,
  ): Promise<ApiResponse<z.infer<typeof wordleDailyStatsSchema>>> {
    const data = await this.client.get(`/api/wordle/stats/${guildId}`);
    return apiResponseSchema(wordleDailyStatsSchema).parse(data);
  }

  async getWordleDayGuesses(
    guildId: string,
  ): Promise<ApiResponse<z.infer<typeof wordleDayGuessesSchema> | null>> {
    const data = await this.client.get(`/api/wordle/day-guesses/${guildId}`);
    return apiResponseSchema(wordleDayGuessesSchema.nullable()).parse(data);
  }

  async getUserWordleSession(
    userId: string,
    guildId: string,
  ): Promise<ApiResponse<z.infer<typeof userWordleSessionSchema> | null>> {
    const data = await this.client.get(
      `/api/wordle/session/${userId}/${guildId}`,
    );
    return apiResponseSchema(userWordleSessionSchema.nullable()).parse(data);
  }

  async forceNewWordleWord(
    guildId: string,
  ): Promise<ApiResponse<z.infer<typeof forceNewWordResultSchema>>> {
    const data = await this.client.post('/api/wordle/admin/force-new-word', {
      guildId,
    });
    return apiResponseSchema(forceNewWordResultSchema).parse(data);
  }

  async setWordleConfig(
    guildId: string,
    channelId: string,
  ): Promise<ApiResponse> {
    const data = apiResponseSchema(z.unknown()).parse(
      await this.client.post('/api/wordle/config', {
        guildId,
        channelId,
      }),
    );
    this.wordleConfigCache.set(guildId, channelId);
    return data;
  }

  async getWordleConfig(
    guildId: string,
  ): Promise<ApiResponse<z.infer<typeof wordleConfigSchema>>> {
    if (this.wordleConfigCache.has(guildId)) {
      return {
        data: { channelId: this.wordleConfigCache.get(guildId) ?? null },
      };
    }
    const raw = await this.client.get(`/api/wordle/config/${guildId}`);
    const parsed = apiResponseSchema(wordleConfigSchema.nullable()).parse(raw);
    const channelId = parsed.data?.channelId ?? null;
    this.wordleConfigCache.set(guildId, channelId);
    return { ...parsed, data: { channelId } };
  }

  async preloadWordleConfigs(guildIds: string[]): Promise<void> {
    await Promise.all(
      guildIds.map(async (guildId) => {
        try {
          await this.getWordleConfig(guildId);
        } catch (err) {
          logger.warn(
            `Failed to preload wordle config for guild ${guildId}:`,
            err,
          );
        }
      }),
    );
  }

  async markWordleAnnounced(
    userId: string,
    guildId: string,
  ): Promise<ApiResponse<{ claimed: boolean }>> {
    const data = await this.client.post('/api/wordle/mark-announced', {
      userId,
      guildId,
    });
    return apiResponseSchema(markWordleAnnouncedResultSchema).parse(data);
  }

  async getUnannouncedWordleWins(
    guildId: string,
  ): Promise<ApiResponse<z.infer<typeof unannouncedWordleWinSchema>[]>> {
    const data = await this.client.get(`/api/wordle/unannounced/${guildId}`);
    return apiResponseSchema(z.array(unannouncedWordleWinSchema)).parse(data);
  }

  async validateWordleGuess(
    guildId: string,
    guess: string,
  ): Promise<
    ApiResponse<{ valid: boolean; wordLength: number; message: string }>
  > {
    const params = new URLSearchParams({ guess });
    const data = await this.client.get(
      `/api/wordle/validate/${guildId}?${params}`,
    );
    return apiResponseSchema(validateWordleGuessResultSchema).parse(data);
  }

  async getWordlistPoolStats(): Promise<
    ApiResponse<{ total: number; used: number; remaining: number }>
  > {
    const data = await this.client.get('/api/wordle/wordlist-pool-stats');
    return apiResponseSchema(wordlistPoolStatsSchema).parse(data);
  }

  async getWordleLeaderboard(
    guildId: string,
    period: 'daily',
  ): Promise<ApiResponse<DailyLeaderboardEntry[]> & { groupStreak: number }>;
  async getWordleLeaderboard(
    guildId: string,
    period: 'weekly' | 'monthly' | 'all-time',
  ): Promise<ApiResponse<RankedLeaderboardEntry[]> & { groupStreak: number }>;
  async getWordleLeaderboard(
    guildId: string,
    period: 'daily' | 'weekly' | 'monthly' | 'all-time',
  ): Promise<
    ApiResponse<DailyLeaderboardEntry[] | RankedLeaderboardEntry[]> & {
      groupStreak: number;
    }
  > {
    const params = new URLSearchParams({ period });
    const raw = await this.client.get(
      `/api/wordle/leaderboard/${guildId}?${params}`,
    );
    if (period === 'daily') {
      return wordleLeaderboardResultSchema(dailyLeaderboardEntrySchema).parse(
        raw,
      );
    }
    return wordleLeaderboardResultSchema(rankedLeaderboardEntrySchema).parse(
      raw,
    );
  }

  async getNextWordlistReviewWord(): Promise<
    ApiResponse<{
      word: string | null;
      index: number;
      total: number;
      done: boolean;
    }>
  > {
    const data = await this.client.get('/api/wordle/review/next');
    return apiResponseSchema(wordleReviewWordResultSchema).parse(data);
  }

  async submitWordlistReviewDecision(
    word: string,
    decision: 'keep' | 'remove',
  ): Promise<
    ApiResponse<{
      word: string | null;
      index: number;
      total: number;
      done: boolean;
    }>
  > {
    const data = await this.client.post('/api/wordle/review/decision', {
      word,
      decision,
    });
    return apiResponseSchema(wordleReviewWordResultSchema).parse(data);
  }
}
