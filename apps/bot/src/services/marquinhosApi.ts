import {
  callContract,
  HttpClient,
  HttpError,
} from '@marquinhos/api-client/bot';
import { env } from '@marquinhos/config/environment';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import type { ContractRequest } from '@marquinhos/contracts/http/contract';
import * as activity from '@marquinhos/contracts/http/routes/activity';
import * as aiChat from '@marquinhos/contracts/http/routes/aiChat';
import * as emojiReaction from '@marquinhos/contracts/http/routes/emojiReaction';
import * as gamification from '@marquinhos/contracts/http/routes/gamification';
import { health } from '@marquinhos/contracts/http/routes/health';
import type {
  DailyLeaderboardEntry,
  RankedLeaderboardEntry,
  WordleLeaderboardPeriod,
} from '@marquinhos/contracts/http/routes/wordle';
import * as wordle from '@marquinhos/contracts/http/routes/wordle';
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

  // Gamification API calls
  async addXP(userId: string, guildId: string, eventType: string) {
    return callContract(this.client, gamification.addXp, {
      body: { userId, guildId, eventType },
    });
  }

  async postGameResult(
    body: ContractRequest<typeof gamification.recordGameResult>['body'],
  ) {
    return callContract(this.client, gamification.recordGameResult, { body });
  }

  async respondToTag(body: ContractRequest<typeof aiChat.respond>['body']) {
    const startedAt = Date.now();
    const data = await callContract(
      this.client,
      aiChat.respond,
      { body },
      { timeout: 120000 },
    );
    logger.info(
      `[ai-chat] respondToTag user=${body.userId} status=${data.data.status} category=${data.data.category ?? '-'} trace=${data.data.traceId ?? '-'} ${Date.now() - startedAt}ms`,
    );
    return data;
  }

  async askInThread(body: ContractRequest<typeof aiChat.askInThread>['body']) {
    const startedAt = Date.now();
    const data = await callContract(
      this.client,
      aiChat.askInThread,
      { body },
      { timeout: 120000 },
    );
    logger.info(
      `[ai-chat] askInThread thread=${body.threadId} status=${data.data.status} trace=${data.data.traceId ?? '-'} ${Date.now() - startedAt}ms`,
    );
    return data;
  }

  async startResearch(
    body: ContractRequest<typeof aiChat.startResearch>['body'],
  ) {
    const data = await callContract(this.client, aiChat.startResearch, {
      body,
    });
    logger.info(
      `[ai-chat] startResearch thread=${body.threadId} status=${data.data.status} job=${data.data.status === 'accepted' ? data.data.jobId : '-'}`,
    );
    return data;
  }

  async getResearchJob(jobId: string) {
    return callContract(this.client, aiChat.getResearchJob, {
      params: { jobId },
    });
  }

  async chooseEmojiReactions(
    body: ContractRequest<typeof emojiReaction.choose>['body'],
  ) {
    return callContract(this.client, emojiReaction.choose, { body });
  }

  async getUserGameStats(userId: string, guildId: string) {
    return callContract(this.client, gamification.getUserGameStats, {
      params: { userId, guildId },
    });
  }

  async getGameLeaderboard(guildId: string, gameType: string) {
    return callContract(this.client, gamification.getGameLeaderboard, {
      params: { guildId, gameType },
    });
  }

  async getUserLevel(userId: string, guildId: string) {
    return callContract(this.client, gamification.getUserLevel, {
      params: { userId, guildId },
    });
  }

  async getLeaderboard(guildId: string, limit: number = 10) {
    return callContract(this.client, gamification.getLeaderboard, {
      params: { guildId },
      query: { limit },
    });
  }

  async getUserAchievements(userId: string, guildId: string) {
    return callContract(this.client, gamification.getUserAchievements, {
      params: { userId, guildId },
    });
  }

  async unlockAchievement(
    userId: string,
    guildId: string,
    achievementId: string,
  ) {
    return callContract(this.client, gamification.unlockAchievement, {
      body: { userId, guildId, achievementId },
    });
  }

  async recordActivityDeepLink(userId: string, guildId: string, game: GameId) {
    return callContract(this.client, activity.recordDeepLink, {
      body: { userId, guildId, game },
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await callContract(this.client, health, {});
      return true;
    } catch {
      return false;
    }
  }

  // Wordle/Termo API calls
  async submitWordleGuess(userId: string, guildId: string, guess: string) {
    return callContract(this.client, wordle.submitGuess, {
      body: { userId, guildId, guess },
    });
  }

  async getWordleStats(guildId: string) {
    return callContract(this.client, wordle.getStats, { params: { guildId } });
  }

  async getWordleDayGuesses(guildId: string) {
    return callContract(this.client, wordle.getDayGuesses, {
      params: { guildId },
    });
  }

  async getUserWordleSession(userId: string, guildId: string) {
    return callContract(this.client, wordle.getUserSession, {
      params: { userId, guildId },
    });
  }

  async forceNewWordleWord(guildId: string) {
    return callContract(this.client, wordle.forceNewWord, {
      body: { guildId },
    });
  }

  async setWordleConfig(guildId: string, channelId: string) {
    const data = await callContract(this.client, wordle.setConfig, {
      body: { guildId, channelId },
    });
    this.wordleConfigCache.set(guildId, channelId);
    return data;
  }

  async getWordleConfig(
    guildId: string,
  ): Promise<{ data: { channelId: string | null } }> {
    if (this.wordleConfigCache.has(guildId)) {
      return {
        data: { channelId: this.wordleConfigCache.get(guildId) ?? null },
      };
    }
    const parsed = await callContract(this.client, wordle.getConfig, {
      params: { guildId },
    });
    const channelId = parsed.data?.channelId ?? null;
    this.wordleConfigCache.set(guildId, channelId);
    return { data: { channelId } };
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

  async markWordleAnnounced(userId: string, guildId: string) {
    return callContract(this.client, wordle.markAnnounced, {
      body: { userId, guildId },
    });
  }

  async getUnannouncedWordleWins(guildId: string) {
    return callContract(this.client, wordle.getUnannouncedWins, {
      params: { guildId },
    });
  }

  async validateWordleGuess(guildId: string, guess: string) {
    return callContract(this.client, wordle.validateGuess, {
      params: { guildId },
      query: { guess },
    });
  }

  async getWordlistPoolStats() {
    return callContract(this.client, wordle.getWordlistPoolStats, {});
  }

  async getWordleLeaderboard(
    guildId: string,
    period: 'daily',
    date?: string,
  ): Promise<{ data: DailyLeaderboardEntry[]; groupStreak: number }>;
  async getWordleLeaderboard(
    guildId: string,
    period: 'weekly' | 'monthly' | 'all-time',
  ): Promise<{ data: RankedLeaderboardEntry[]; groupStreak: number }>;
  async getWordleLeaderboard(
    guildId: string,
    period: WordleLeaderboardPeriod,
    date?: string,
  ): Promise<{
    data: DailyLeaderboardEntry[] | RankedLeaderboardEntry[];
    groupStreak: number;
  }> {
    const result = await callContract(this.client, wordle.getLeaderboard, {
      params: { guildId },
      query: date ? { period, date } : { period },
    });
    const entries =
      period === 'daily'
        ? z.array(wordle.dailyLeaderboardEntrySchema)
        : z.array(wordle.rankedLeaderboardEntrySchema);
    return {
      data: entries.parse(result.data),
      groupStreak: result.groupStreak,
    };
  }

  async getNextWordlistReviewWord() {
    return callContract(this.client, wordle.getNextReviewWord, {});
  }

  async submitWordlistReviewDecision(
    word: string,
    decision: 'keep' | 'remove',
  ) {
    return callContract(this.client, wordle.submitReviewDecision, {
      body: { word, decision },
    });
  }
}
