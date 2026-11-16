import type { WordleAchievementsOverview } from '@marquinhos/contracts/wordle';
import { Inject, Injectable } from '@nestjs/common';
import { logger } from 'common/logging/logger';
import { WordleGlobalAchievementService } from 'modules/wordle/progression/wordle-global-achievement.service';
import {
  WordleGlobalGameplayService,
  type GlobalGuessResult,
} from './wordle-global-gameplay.service';

interface GlobalAwards {
  checkAndAward(
    userId: string,
    guildId: string,
  ): Promise<{ unlockedIds: string[] }>;
  getOverview(
    userId: string,
    guildId: string,
    viewerId: string,
  ): Promise<WordleAchievementsOverview>;
}

/** Coordinates a committed guess and its retryable achievement evaluation. */
@Injectable()
export class WordleGlobalGameCoordinator {
  constructor(
    private readonly game: WordleGlobalGameplayService,
    @Inject(WordleGlobalAchievementService)
    private readonly awards: GlobalAwards,
  ) {}

  async submitGuess(
    userId: string,
    guildId: string,
    date: string,
    guess: string,
    captureAchievementBaseline = false,
    requestId?: string,
  ) {
    const result = await this.game.submitGuess(
      userId,
      date,
      guess,
      guildId,
      captureAchievementBaseline,
      requestId,
    );
    return this.finishGuess(userId, guildId, date, result, requestId);
  }

  async replayGuess(
    userId: string,
    guildId: string,
    date: string,
    guess: string,
    requestId: string,
  ) {
    const result = await this.game.replayGuess(userId, date, guess, requestId);
    if (!result) return null;
    return this.finishGuess(userId, guildId, date, result, requestId);
  }

  async replayById(
    userId: string,
    guildId: string,
    guess: string,
    requestId: string,
  ) {
    const result = await this.game.findReceipt(userId, guess, requestId);
    if (!result) return null;
    if ('error' in result) return result;
    return this.finishGuess(
      userId,
      guildId,
      result.replayDate,
      result,
      requestId,
    );
  }

  private async finishGuess(
    userId: string,
    guildId: string,
    date: string,
    result: GlobalGuessResult,
    requestId?: string,
  ) {
    if ('error' in result) return result;
    const { replayGuildId, replayDate, ...publicResult } = result;
    try {
      const award = await this.awards.checkAndAward(
        userId,
        replayGuildId ?? guildId,
      );
      await this.game.markAwardReconciled(
        userId,
        replayDate ?? date,
        result.attempts,
        requestId,
      );
      const overview = await this.awards.getOverview(userId, guildId, userId);
      return {
        ...publicResult,
        achievementUpdate: { overview, unlockedIds: award.unlockedIds },
      };
    } catch (error) {
      logger.warn('wordle.achievement_evaluation_failed', {
        error,
        userId,
        guildId,
        date,
      });
      return publicResult;
    }
  }

  async reconcile(
    userId: string,
    guildId: string,
  ): Promise<{ unlockedIds: string[] }> {
    const pending = await this.game.pendingAwards(userId);
    const unlockedIds: string[] = [];
    for (const item of pending) {
      if (!item.guildId) continue;
      const award = await this.awards.checkAndAward(userId, item.guildId);
      await this.game.finishPendingAward(item.sessionId, item.attempt, true);
      unlockedIds.push(...award.unlockedIds);
    }
    const current = await this.awards.checkAndAward(userId, guildId);
    unlockedIds.push(...current.unlockedIds);
    return { unlockedIds };
  }

  async reconcilePending(): Promise<void> {
    for (const item of await this.game.pendingAwards()) {
      if (!item.guildId) continue;
      try {
        await this.awards.checkAndAward(item.userId, item.guildId);
        await this.game.finishPendingAward(item.sessionId, item.attempt, true);
      } catch (error) {
        logger.warn('wordle.pending_achievement_failed', {
          error,
          userId: item.userId,
          guildId: item.guildId,
        });
        await this.game.finishPendingAward(item.sessionId, item.attempt, false);
      }
    }
  }

  async hasPendingAwards(userId: string): Promise<boolean> {
    return (await this.game.pendingAwards(userId)).length > 0;
  }
}
