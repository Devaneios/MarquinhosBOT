import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/wordle';
import { Inject, Injectable } from '@nestjs/common';
import { visibleWordleEvidence } from 'modules/wordle/progression/wordle-evidence-visibility';
import { WordleRewardsService } from 'modules/wordle/progression/wordle-rewards.service';
import { WordleShowcaseService } from 'modules/wordle/progression/wordle-showcase.service';
import { WordleService } from 'modules/wordle/wordle.service';
import { WORDLE_TODAY } from 'modules/wordle/wordle.tokens';

const PUBLIC_VIEWER_ID = '';

@Injectable()
export class WordlePlayerOverviewService {
  constructor(
    private readonly wordle: WordleService,
    private readonly rewards: WordleRewardsService,
    private readonly showcase: WordleShowcaseService,
    @Inject(WORDLE_TODAY) private readonly today: () => string,
  ) {}

  async getPublicPlayerOverview(
    userId: string,
    guildId: string,
  ): Promise<ContractResponseInput<typeof contract.getAchievements>['data']> {
    const overview = await this.wordle.getAchievementsOverview(
      userId,
      guildId,
      PUBLIC_VIEWER_ID,
    );
    await this.rewards.reconcile(userId);
    const cosmetics = await this.rewards.get(userId);
    const achievements = overview.achievements.map((achievement) =>
      achievement.matchEvidence === undefined
        ? achievement
        : {
            ...achievement,
            matchEvidence: visibleWordleEvidence(
              achievement.matchEvidence,
              userId,
              PUBLIC_VIEWER_ID,
              this.today(),
            ),
          },
    );

    return {
      ...overview,
      achievements,
      showcase: await this.showcase.get(userId),
      cosmetics: {
        title: cosmetics.title,
        frame: cosmetics.frame,
        badges: cosmetics.badges,
      },
    };
  }
}
