import { db } from 'database/sqlite';
import { EvolutiveAchievementsService } from 'services/evolutiveAchievements';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';
import type {
  AddXpResult,
  GameResultInput,
  UserLevel,
  UserStats,
  XpConfig,
} from 'services/gamification/types';

const evolutiveService = new EvolutiveAchievementsService();

export class GamificationService {
  private readonly levelingService: LevelingService;
  private achievementService: AchievementService;

  constructor() {
    this.levelingService = new LevelingService();
    this.achievementService = new AchievementService(this.levelingService);
  }

  initializeDefaults(): void {
    this.levelingService.initializeDefaults();
    this.achievementService.initializeDefaults();
  }

  getXpConfig(): XpConfig[] {
    return this.levelingService.getXpConfig();
  }

  getUserLevel(userId: string, guildId: string): UserLevel {
    return this.levelingService.getUserLevel(userId, guildId);
  }

  addXP(userId: string, guildId: string, eventType: string): AddXpResult {
    this.levelingService.ensureUser(userId, guildId);

    const config = db
      .query<XpConfig, { $eventType: string }>(
        'SELECT * FROM xp_config WHERE event_type = $eventType',
      )
      .get({ $eventType: eventType });

    if (!config) throw new Error(`Unknown event type: ${eventType}`);

    if (config.cooldown_ms !== null) {
      const now = Date.now();
      const result = db
        .query<
          { granted: number },
          {
            $userId: string;
            $guildId: string;
            $eventType: string;
            $now: number;
            $cooldownMs: number;
          }
        >(
          `INSERT INTO xp_cooldowns (user_id, guild_id, event_type, last_gain)
           VALUES ($userId, $guildId, $eventType, $now)
           ON CONFLICT(user_id, guild_id, event_type) DO UPDATE SET
             last_gain = CASE
               WHEN ($now - xp_cooldowns.last_gain) >= $cooldownMs THEN $now
               ELSE xp_cooldowns.last_gain
             END
           RETURNING (last_gain = $now) AS granted`,
        )
        .get({
          $userId: userId,
          $guildId: guildId,
          $eventType: eventType,
          $now: now,
          $cooldownMs: config.cooldown_ms,
        });

      if (result && result.granted !== 1) {
        return {
          userLevel: this.levelingService.getUserLevel(userId, guildId),
          onCooldown: true,
          leveledUp: false,
          unlockedAchievements: [],
        };
      }
    }

    if (eventType === 'command') {
      db.query(
        'UPDATE user_stats SET total_commands = total_commands + 1 WHERE user_id = $userId AND guild_id = $guildId',
      ).run({ $userId: userId, $guildId: guildId });
    } else if (eventType === 'scrobble') {
      db.query(
        'UPDATE user_stats SET total_scrobbles = total_scrobbles + 1 WHERE user_id = $userId AND guild_id = $guildId',
      ).run({ $userId: userId, $guildId: guildId });
    } else if (eventType === 'voice_join') {
      db.query(
        'UPDATE user_stats SET total_voice_joins = total_voice_joins + 1 WHERE user_id = $userId AND guild_id = $guildId',
      ).run({ $userId: userId, $guildId: guildId });
    }

    db.query(
      'UPDATE user_levels SET xp = xp + $amount, total_xp = total_xp + $amount, last_xp_gain = $now WHERE user_id = $userId AND guild_id = $guildId',
    ).run({
      $amount: config.xp_amount,
      $now: Date.now(),
      $userId: userId,
      $guildId: guildId,
    });

    const leveledUp = this.levelingService.applyLevelUps(userId, guildId);
    const userLevel = this.levelingService.getUserLevel(userId, guildId);
    const unlockedAchievements =
      this.achievementService.checkAndAwardAchievements(userId, guildId);
    evolutiveService.checkAndEvolveAll(userId, guildId);

    return {
      userLevel,
      onCooldown: false,
      leveledUp,
      newLevel: leveledUp ? userLevel.level : undefined,
      unlockedAchievements,
    };
  }

  recordGameResult(input: GameResultInput): void {
    const fn = db.transaction(() => {
      const now = Date.now();

      const winXp = (
        db
          .query<{ xp_amount: number }, { $event: string }>(
            'SELECT xp_amount FROM xp_config WHERE event_type = $event',
          )
          .get({ $event: 'game_win' }) ?? { xp_amount: 20 }
      ).xp_amount;

      const participateXp = (
        db
          .query<{ xp_amount: number }, { $event: string }>(
            'SELECT xp_amount FROM xp_config WHERE event_type = $event',
          )
          .get({ $event: 'game_participate' }) ?? { xp_amount: 5 }
      ).xp_amount;

      db.query(
        'INSERT OR IGNORE INTO game_results (id, guild_id, game_type, played_at, duration_ms) VALUES ($id, $guildId, $gameType, $playedAt, $durationMs)',
      ).run({
        $id: input.sessionId,
        $guildId: input.guildId,
        $gameType: input.gameType,
        $playedAt: now,
        $durationMs: input.durationMs ?? null,
      });

      for (const player of input.results) {
        this.levelingService.ensureUser(player.userId, input.guildId);
        const xpAwarded = player.position === 1 ? winXp : participateXp;

        const insertResult = db
          .query(
            'INSERT OR IGNORE INTO user_game_results (game_result_id, user_id, guild_id, position, xp_awarded) VALUES ($gameId, $userId, $guildId, $position, $xpAwarded)',
          )
          .run({
            $gameId: input.sessionId,
            $userId: player.userId,
            $guildId: input.guildId,
            $position: player.position,
            $xpAwarded: xpAwarded,
          });

        if (insertResult.changes > 0) {
          db.query(
            'UPDATE user_levels SET xp = xp + $amount, total_xp = total_xp + $amount, last_xp_gain = $now WHERE user_id = $userId AND guild_id = $guildId',
          ).run({
            $amount: xpAwarded,
            $now: now,
            $userId: player.userId,
            $guildId: input.guildId,
          });

          db.query(
            'UPDATE user_stats SET total_games = total_games + 1, games_won = games_won + $wonIncrement WHERE user_id = $userId AND guild_id = $guildId',
          ).run({
            $wonIncrement: player.position === 1 ? 1 : 0,
            $userId: player.userId,
            $guildId: input.guildId,
          });

          this.levelingService.applyLevelUps(player.userId, input.guildId);
          this.achievementService.checkAndAwardAchievements(
            player.userId,
            input.guildId,
          );
        }
      }
    });
    fn();
  }

  getUserGameStats(
    userId: string,
    guildId: string,
  ): {
    stats: UserStats;
    byGame: { game_type: string; games_played: number; wins: number }[];
  } {
    this.levelingService.ensureUser(userId, guildId);

    const stats = db
      .query<UserStats, { $userId: string; $guildId: string }>(
        'SELECT * FROM user_stats WHERE user_id = $userId AND guild_id = $guildId',
      )
      .get({ $userId: userId, $guildId: guildId })!;

    const byGame = db
      .query<
        { game_type: string; games_played: number; wins: number },
        { $userId: string; $guildId: string }
      >(
        `SELECT gr.game_type,
                COUNT(*) as games_played,
                SUM(CASE WHEN ugr.position = 1 THEN 1 ELSE 0 END) as wins
         FROM user_game_results ugr
         JOIN game_results gr ON gr.id = ugr.game_result_id
         WHERE ugr.user_id = $userId AND ugr.guild_id = $guildId
         GROUP BY gr.game_type
         ORDER BY games_played DESC`,
      )
      .all({ $userId: userId, $guildId: guildId });

    return { stats, byGame };
  }

  getGameLeaderboard(guildId: string, gameType: string) {
    return db
      .query<
        {
          user_id: string;
          wins: number;
          games_played: number;
          total_xp_earned: number;
        },
        { $guildId: string; $gameType: string }
      >(
        `SELECT ugr.user_id,
                COUNT(*) as games_played,
                SUM(CASE WHEN ugr.position = 1 THEN 1 ELSE 0 END) as wins,
                SUM(ugr.xp_awarded) as total_xp_earned
         FROM user_game_results ugr
         JOIN game_results gr ON gr.id = ugr.game_result_id
         WHERE ugr.guild_id = $guildId AND gr.game_type = $gameType
         GROUP BY ugr.user_id
         ORDER BY wins DESC, total_xp_earned DESC
         LIMIT 25`,
      )
      .all({ $guildId: guildId, $gameType: gameType });
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
  ): boolean {
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
