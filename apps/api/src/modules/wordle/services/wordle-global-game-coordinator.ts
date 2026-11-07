import type { WordleAchievementsOverview } from '@marquinhos/contracts/wordle';
import { Inject, Injectable } from '@nestjs/common';
import { WordleGlobalAchievementService } from './wordle-global-achievement.service';
import { WordleGlobalGameplayService } from './wordle-global-gameplay.service';

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
  ) {
    const result = await this.game.submitGuess(userId, date, guess);
    if ('error' in result) return result;
    try {
      const award = await this.awards.checkAndAward(userId, guildId);
      const overview = await this.awards.getOverview(userId, guildId, userId);
      return {
        ...result,
        achievementUpdate: { overview, unlockedIds: award.unlockedIds },
      };
    } catch (error) {
      console.warn('[wordle] global achievement evaluation failed', error);
      return result;
    }
  }

  async reconcile(
    userId: string,
    guildId: string,
  ): Promise<{ unlockedIds: string[] }> {
    return this.awards.checkAndAward(userId, guildId);
  }
}
