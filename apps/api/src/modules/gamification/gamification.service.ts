import { db, type Db, type DbExecutor } from '@marquinhos/database/client';
import {
  gameResults,
  userGameResults,
  userStats,
  xpConfig,
  xpCooldowns,
} from '@marquinhos/database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { and, desc, eq, sql } from 'drizzle-orm';
import { AchievementService } from 'modules/gamification/achievement.service';
import { EvolutiveAchievementsService } from 'modules/gamification/evolutive-achievements.service';
import { LevelingService } from 'modules/gamification/leveling.service';
import type {
  AddXpResult,
  GameResultInput,
  UserLevel,
  UserStats,
  XpConfig,
} from 'modules/gamification/types';

const DEFAULT_WIN_XP = 20;
const DEFAULT_PARTICIPATE_XP = 5;
const GAME_LEADERBOARD_LIMIT = 25;

const STAT_BY_EVENT: Record<
  string,
  'total_commands' | 'total_scrobbles' | 'total_voice_joins'
> = {
  command: 'total_commands',
  scrobble: 'total_scrobbles',
  voice_join: 'total_voice_joins',
};

const winsSql = sql<number>`sum(CASE WHEN ${userGameResults.position} = 1 THEN 1 ELSE 0 END)::int`;

async function xpAmount(
  exec: DbExecutor,
  eventType: string,
  fallback: number,
): Promise<number> {
  const [row] = await exec
    .select({ xp_amount: xpConfig.xp_amount })
    .from(xpConfig)
    .where(eq(xpConfig.event_type, eventType));
  return row?.xp_amount ?? fallback;
}

@Injectable()
export class GamificationService {
  constructor(
    private readonly levelingService: LevelingService = new LevelingService(),
    private readonly achievementService: AchievementService = new AchievementService(
      levelingService,
    ),
    private readonly evolutiveService: EvolutiveAchievementsService = new EvolutiveAchievementsService(),
    @Inject(DB) private readonly database: Db = db,
  ) {}

  async initializeDefaults(): Promise<void> {
    await this.levelingService.initializeDefaults();
    await this.achievementService.initializeDefaults();
  }

  getXpConfig(): Promise<XpConfig[]> {
    return this.levelingService.getXpConfig();
  }

  getUserLevel(userId: string, guildId: string): Promise<UserLevel> {
    return this.levelingService.getUserLevel(userId, guildId);
  }

  async addXP(
    userId: string,
    guildId: string,
    eventType: string,
  ): Promise<AddXpResult> {
    await this.levelingService.ensureUser(userId, guildId);

    const [config] = await this.database
      .select()
      .from(xpConfig)
      .where(eq(xpConfig.event_type, eventType));

    if (!config) throw new Error(`Unknown event type: ${eventType}`);

    if (config.cooldown_ms !== null) {
      const now = Date.now();
      // A row comes back only when this call earned the XP: a fresh insert,
      // or an update the cooldown allowed. Comparing timestamps instead would
      // grant every concurrent call made within the same millisecond.
      const granted = await this.database
        .insert(xpCooldowns)
        .values({
          user_id: userId,
          guild_id: guildId,
          event_type: eventType,
          last_gain: now,
        })
        .onConflictDoUpdate({
          target: [
            xpCooldowns.user_id,
            xpCooldowns.guild_id,
            xpCooldowns.event_type,
          ],
          set: { last_gain: now },
          setWhere: sql`${now}::bigint - ${xpCooldowns.last_gain} >= ${config.cooldown_ms}::bigint`,
        })
        .returning({ lastGain: xpCooldowns.last_gain });

      if (granted.length === 0) {
        return {
          userLevel: await this.levelingService.getUserLevel(userId, guildId),
          onCooldown: true,
          leveledUp: false,
          unlockedAchievements: [],
        };
      }
    }

    const statColumn = STAT_BY_EVENT[eventType];
    if (statColumn) {
      await this.database
        .update(userStats)
        .set({ [statColumn]: sql`${userStats[statColumn]} + 1` })
        .where(
          and(eq(userStats.user_id, userId), eq(userStats.guild_id, guildId)),
        );
    }

    await this.levelingService.addXpToUser(userId, guildId, config.xp_amount);

    const leveledUp = await this.levelingService.applyLevelUps(userId, guildId);
    const userLevel = await this.levelingService.getUserLevel(userId, guildId);
    const unlockedAchievements =
      await this.achievementService.checkAndAwardAchievements(userId, guildId);
    await this.evolutiveService.checkAndEvolveAll(userId, guildId);

    return {
      userLevel,
      onCooldown: false,
      leveledUp,
      newLevel: leveledUp ? userLevel.level : undefined,
      unlockedAchievements,
    };
  }

  async recordGameResult(input: GameResultInput): Promise<void> {
    await this.database.transaction(async (tx) => {
      const now = Date.now();
      const winXp = await xpAmount(tx, 'game_win', DEFAULT_WIN_XP);
      const participateXp = await xpAmount(
        tx,
        'game_participate',
        DEFAULT_PARTICIPATE_XP,
      );

      const insertedGame = await tx
        .insert(gameResults)
        .values({
          id: input.sessionId,
          guild_id: input.guildId,
          game_type: input.gameType,
          played_at: now,
          duration_ms: input.durationMs ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: gameResults.id });
      if (insertedGame.length === 0) {
        const [existing] = await tx
          .select({
            guild_id: gameResults.guild_id,
            game_type: gameResults.game_type,
          })
          .from(gameResults)
          .where(eq(gameResults.id, input.sessionId));
        if (
          !existing ||
          existing.guild_id !== input.guildId ||
          existing.game_type !== input.gameType
        ) {
          throw new Error('Game result ID collision with different game data');
        }
      }

      for (const player of input.results) {
        await this.levelingService.ensureUser(player.userId, input.guildId, tx);
        const xpAwarded = player.position === 1 ? winXp : participateXp;

        // Only a freshly inserted row awards XP, so a replayed result is a no-op.
        const inserted = await tx
          .insert(userGameResults)
          .values({
            game_result_id: input.sessionId,
            user_id: player.userId,
            position: player.position,
            xp_awarded: xpAwarded,
          })
          .onConflictDoNothing()
          .returning({ userId: userGameResults.user_id });

        if (inserted.length === 0) continue;

        await this.levelingService.addXpToUser(
          player.userId,
          input.guildId,
          xpAwarded,
          tx,
          now,
        );

        await tx
          .update(userStats)
          .set({
            total_games: sql`${userStats.total_games} + 1`,
            games_won: sql`${userStats.games_won} + ${player.position === 1 ? 1 : 0}`,
          })
          .where(
            and(
              eq(userStats.user_id, player.userId),
              eq(userStats.guild_id, input.guildId),
            ),
          );

        await this.levelingService.applyLevelUps(
          player.userId,
          input.guildId,
          tx,
        );
        await this.achievementService.checkAndAwardAchievements(
          player.userId,
          input.guildId,
          tx,
        );
      }
    });
  }

  async getUserGameStats(
    userId: string,
    guildId: string,
  ): Promise<{
    stats: UserStats;
    byGame: { game_type: string; games_played: number; wins: number }[];
  }> {
    await this.levelingService.ensureUser(userId, guildId);

    const [stats] = await this.database
      .select()
      .from(userStats)
      .where(
        and(eq(userStats.user_id, userId), eq(userStats.guild_id, guildId)),
      );

    const gamesPlayed = sql<number>`count(*)::int`;
    const byGame = await this.database
      .select({
        game_type: gameResults.game_type,
        games_played: gamesPlayed,
        wins: winsSql,
      })
      .from(userGameResults)
      .innerJoin(
        gameResults,
        eq(gameResults.id, userGameResults.game_result_id),
      )
      .where(
        and(
          eq(userGameResults.user_id, userId),
          eq(gameResults.guild_id, guildId),
        ),
      )
      .groupBy(gameResults.game_type)
      .orderBy(desc(gamesPlayed));

    return { stats: stats!, byGame };
  }

  async getGameLeaderboard(guildId: string, gameType: string) {
    const totalXpEarned = sql<number>`sum(${userGameResults.xp_awarded})::int`;
    return this.database
      .select({
        user_id: userGameResults.user_id,
        games_played: sql<number>`count(*)::int`,
        wins: winsSql,
        total_xp_earned: totalXpEarned,
      })
      .from(userGameResults)
      .innerJoin(
        gameResults,
        eq(gameResults.id, userGameResults.game_result_id),
      )
      .where(
        and(
          eq(gameResults.guild_id, guildId),
          eq(gameResults.game_type, gameType),
        ),
      )
      .groupBy(userGameResults.user_id)
      .orderBy(desc(winsSql), desc(totalXpEarned))
      .limit(GAME_LEADERBOARD_LIMIT);
  }

  getLeaderboard(guildId: string, limit: number = 10) {
    return this.levelingService.getLeaderboard(guildId, limit);
  }

  // Achievement delegation
  getUserAchievements(userId: string, guildId: string) {
    return this.achievementService.getUserAchievements(userId, guildId);
  }

  getAllAchievements() {
    return this.achievementService.getAllAchievements();
  }

  unlockAchievement(
    userId: string,
    guildId: string,
    achievementId: string,
  ): Promise<boolean> {
    return this.achievementService.unlockAchievement(
      userId,
      guildId,
      achievementId,
    );
  }

  createAchievement(
    data: Parameters<AchievementService['createAchievement']>[0],
  ) {
    return this.achievementService.createAchievement(data);
  }
}
