import type { WordleAchievementsOverview } from '@marquinhos/contracts/wordle';
import type { WordleGlobalGameplayService } from './WordleGlobalGameplayService';

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
export class WordleGlobalGameCoordinator {
  constructor(
    private readonly game: WordleGlobalGameplayService,
    private readonly awards: GlobalAwards,
    private readonly warn: (error: unknown) => void = (error) =>
      console.warn('[wordle] global achievement evaluation failed', error),
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
      this.warn(error);
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
