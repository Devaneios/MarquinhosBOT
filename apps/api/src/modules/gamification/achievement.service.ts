import { achievementRaritySchema } from '@marquinhos/contracts/http/routes/gamification';
import type { Db, DbExecutor } from '@marquinhos/database/client';
import { achievements, userAchievements } from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { achievementXpForRarity } from '@marquinhos/domain/games/wordle/achievements/rewards';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { and, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm';
import { LevelingService } from 'modules/gamification/leveling.service';

@Injectable()
export class AchievementService {
  constructor(
    private readonly levelingService: LevelingService,
    @Inject(DB) private readonly database: Db,
  ) {}

  async initializeDefaults(): Promise<void> {
    // The handcrafted Wordle catalog is the complete active achievement set.
    await this.database.transaction(async (tx) => {
      const catalogIds = WORDLE_ACHIEVEMENT_CATALOG.map(({ id }) => id);
      await tx
        .update(achievements)
        .set({ archived_at: Date.now() })
        .where(
          and(
            isNull(achievements.archived_at),
            notInArray(achievements.id, catalogIds),
          ),
        );
      const retiredGenericIds = (
        await tx
          .select({ id: achievements.id })
          .from(achievements)
          .where(
            and(
              ne(achievements.category, 'wordle'),
              notInArray(achievements.id, catalogIds),
            ),
          )
      ).map(({ id }) => id);
      if (retiredGenericIds.length > 0) {
        await tx
          .delete(userAchievements)
          .where(inArray(userAchievements.achievement_id, retiredGenericIds));
      }
      const catalogRows = WORDLE_ACHIEVEMENT_CATALOG.map((definition) => ({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        category: 'wordle',
        rarity: definition.rarity,
        icon: definition.icon,
        condition: null,
        reward_xp: achievementXpForRarity(definition.rarity),
        archived_at: null,
      }));
      await tx
        .insert(achievements)
        .values(catalogRows)
        .onConflictDoUpdate({
          target: achievements.id,
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            category: sql`excluded.category`,
            rarity: sql`excluded.rarity`,
            icon: sql`excluded.icon`,
            condition: sql`excluded.condition`,
            reward_xp: sql`excluded.reward_xp`,
            archived_at: null,
          },
        });
    });
  }

  async unlockAchievement(
    userId: string,
    guildId: string,
    achievementId: string,
    exec: DbExecutor = this.database,
  ): Promise<boolean> {
    return (
      (await this.unlockAchievements(userId, guildId, [achievementId], exec))
        .length > 0
    );
  }

  async unlockAchievements(
    userId: string,
    guildId: string,
    achievementIds: readonly string[],
    exec: DbExecutor = this.database,
  ): Promise<readonly { id: string; unlockedAt: number }[]> {
    if (exec === this.database)
      return this.database.transaction((tx) =>
        this.unlockAchievements(userId, guildId, achievementIds, tx),
      );
    const requestedIds = [...new Set(achievementIds)];
    if (requestedIds.length === 0) return [];

    const definitions = await exec
      .select({ id: achievements.id, rarity: achievements.rarity })
      .from(achievements)
      .where(
        and(
          inArray(achievements.id, requestedIds),
          isNull(achievements.archived_at),
        ),
      );
    const eligibleIds = new Set(definitions.map((row) => row.id));
    const rewardById = new Map(
      definitions.map((row) => [
        row.id,
        achievementXpForRarity(achievementRaritySchema.parse(row.rarity)),
      ]),
    );
    const eligible = requestedIds.filter((id) => eligibleIds.has(id));
    if (eligible.length === 0) return [];

    await this.levelingService.ensureUser(userId, guildId, exec);

    const inserted = await exec
      .insert(userAchievements)
      .values(
        eligible.map((id) => ({
          user_id: userId,
          guild_id: guildId,
          achievement_id: id,
          unlocked_at: Date.now(),
        })),
      )
      .onConflictDoNothing()
      .returning({
        id: userAchievements.achievement_id,
        unlockedAt: userAchievements.unlocked_at,
      });

    if (inserted.length === 0) return [];

    const insertedIds = new Set(inserted.map((row) => row.id));
    const rewardXp = eligible.reduce(
      (total, id) =>
        insertedIds.has(id)
          ? total + Math.max(0, rewardById.get(id) ?? 0)
          : total,
      0,
    );
    if (rewardXp > 0) {
      await this.levelingService.addXpToUser(
        userId,
        guildId,
        rewardXp,
        exec,
        null,
      );
      await this.levelingService.applyLevelUps(userId, guildId, exec);
    }

    const insertedById = new Map(inserted.map((row) => [row.id, row]));
    return eligible.flatMap((id) => {
      const row = insertedById.get(id);
      return row ? [{ id: row.id, unlockedAt: row.unlockedAt }] : [];
    });
  }
}
