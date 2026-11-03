import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityGoals,
  wordleEquippedRewards,
  wordleGlobalAchievements,
  wordleGoalAwards,
  wordlePersonalRewards,
} from '@marquinhos/database/schema';
import {
  unlockedWordleRewards,
  WORDLE_PERSONAL_REWARDS,
} from '@marquinhos/domain/games/wordle/community/rewards';
import { and, asc, eq, sql } from 'drizzle-orm';

export class InvalidWordleReward extends Error {}
type RewardKind = 'title' | 'frame';

export class WordleRewardsService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async reconcile(userId: string): Promise<void> {
    const rows = await this.database
      .select({ id: wordleGlobalAchievements.achievement_id })
      .from(wordleGlobalAchievements)
      .where(eq(wordleGlobalAchievements.user_id, userId));
    const ids = unlockedWordleRewards(new Set(rows.map((row) => row.id)));
    if (ids.length)
      await this.database
        .insert(wordlePersonalRewards)
        .values(
          ids.map((rewardId) => ({
            user_id: userId,
            reward_id: rewardId,
            granted_at: this.now(),
          })),
        )
        .onConflictDoNothing();
  }

  async get(userId: string) {
    const owned = await this.database
      .select({ id: wordlePersonalRewards.reward_id })
      .from(wordlePersonalRewards)
      .where(eq(wordlePersonalRewards.user_id, userId))
      .orderBy(asc(wordlePersonalRewards.reward_id));
    const equipment = await this.database
      .select()
      .from(wordleEquippedRewards)
      .where(eq(wordleEquippedRewards.user_id, userId));
    const badges = await this.database
      .select({
        goalId: wordleGoalAwards.goal_id,
        guildId: wordleCommunityGoals.guild_id,
        grantedAt: wordleGoalAwards.granted_at,
        startsAt: wordleCommunityGoals.starts_at,
        endsAt: wordleCommunityGoals.ends_at,
      })
      .from(wordleGoalAwards)
      .innerJoin(
        wordleCommunityGoals,
        eq(wordleCommunityGoals.id, wordleGoalAwards.goal_id),
      )
      .where(eq(wordleGoalAwards.user_id, userId))
      .orderBy(asc(wordleGoalAwards.granted_at), asc(wordleGoalAwards.goal_id));
    return {
      owned: owned.map((row) => row.id),
      title: equipment.find((row) => row.kind === 'title')?.reward_id ?? null,
      frame: equipment.find((row) => row.kind === 'frame')?.reward_id ?? null,
      badges,
    };
  }

  async equip(
    userId: string,
    kind: RewardKind,
    rewardId: string | null,
  ): Promise<void> {
    if (
      rewardId !== null &&
      !WORDLE_PERSONAL_REWARDS.some(
        (reward) => reward.id === rewardId && reward.kind === kind,
      )
    )
      throw new InvalidWordleReward('Invalid reward');
    await this.database.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-reward-equipment', userId])}, 0))`,
      );
      if (rewardId === null) {
        await tx
          .delete(wordleEquippedRewards)
          .where(
            and(
              eq(wordleEquippedRewards.user_id, userId),
              eq(wordleEquippedRewards.kind, kind),
            ),
          );
        return;
      }
      const owned = await tx
        .select()
        .from(wordlePersonalRewards)
        .where(
          and(
            eq(wordlePersonalRewards.user_id, userId),
            eq(wordlePersonalRewards.reward_id, rewardId),
          ),
        );
      if (!owned.length) throw new InvalidWordleReward('Reward not owned');
      await tx
        .insert(wordleEquippedRewards)
        .values({ user_id: userId, kind, reward_id: rewardId })
        .onConflictDoUpdate({
          target: [wordleEquippedRewards.user_id, wordleEquippedRewards.kind],
          set: { reward_id: rewardId },
        });
    });
  }
}
