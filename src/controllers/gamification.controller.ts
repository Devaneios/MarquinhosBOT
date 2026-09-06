import type { Request, Response } from 'express';
import type {
  AddXpResult,
  UserAchievement,
  UserLevel,
} from 'services/gamification';
import { GamificationService } from 'services/gamification';

interface UserGuildParams {
  userId: string;
  guildId: string;
}

interface GuildParams {
  guildId: string;
}

interface GuildGameTypeParams {
  guildId: string;
  gameType: string;
}

// Transform helpers — convert snake_case DB rows to camelCase for bot/web consumers
function formatLevel(row: UserLevel) {
  return {
    userId: row.user_id,
    guildId: row.guild_id,
    level: row.level,
    xp: row.xp,
    totalXp: row.total_xp,
    lastXpGain: row.last_xp_gain ? new Date(row.last_xp_gain) : null,
  };
}

function formatAchievement(row: UserAchievement) {
  return {
    userId: row.user_id,
    guildId: row.guild_id,
    achievementId: row.achievement_id,
    unlockedAt: new Date(row.unlocked_at),
    name: row.name,
    description: row.description,
    category: row.category,
    rarity: row.rarity,
    icon: row.icon,
    rewardXp: row.reward_xp,
  };
}

function formatAddXpResult(result: AddXpResult) {
  return {
    userLevel: formatLevel(result.userLevel),
    onCooldown: result.onCooldown,
    leveledUp: result.leveledUp,
    newLevel: result.newLevel,
    unlockedAchievements: result.unlockedAchievements,
  };
}

class GamificationController {
  private service: GamificationService;

  constructor() {
    this.service = new GamificationService();
  }

  getXpConfig(req: Request, res: Response) {
    try {
      const data = this.service.getXpConfig();
      return res.status(200).json({ data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  addXP(req: Request, res: Response) {
    try {
      const { userId, guildId, eventType } = req.body as {
        userId: string;
        guildId: string;
        eventType: string;
      };

      if (!userId || !guildId || !eventType) {
        return res
          .status(400)
          .json({ message: 'userId, guildId, and eventType are required' });
      }

      const result = this.service.addXP(userId, guildId, eventType);
      const data = formatAddXpResult(result);
      return res.status(200).json({
        data,
        message: result.onCooldown ? 'On cooldown' : 'XP added',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getUserLevel(
    req: Request<
      UserGuildParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ) {
    try {
      const { userId, guildId } = req.params;
      const row = this.service.getUserLevel(userId, guildId);
      return res.status(200).json({ data: formatLevel(row) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getLeaderboard(
    req: Request<GuildParams, Record<string, unknown>, Record<string, unknown>>,
    res: Response,
  ) {
    try {
      const { guildId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 25);
      const rows = this.service.getLeaderboard(guildId, limit);
      return res.status(200).json({ data: rows.map(formatLevel) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  unlockAchievement(req: Request, res: Response) {
    try {
      const { userId, guildId, achievementId } = req.body as {
        userId: string;
        guildId: string;
        achievementId: string;
      };

      if (!userId || !guildId || !achievementId) {
        return res
          .status(400)
          .json({ message: 'userId, guildId, and achievementId are required' });
      }

      const unlocked = this.service.unlockAchievement(
        userId,
        guildId,
        achievementId,
      );
      return res.status(200).json({
        data: { unlocked },
        message: unlocked ? 'Achievement unlocked' : 'Already unlocked',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getUserAchievements(
    req: Request<
      UserGuildParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ) {
    try {
      const { userId, guildId } = req.params;
      const rows = this.service.getUserAchievements(userId, guildId);
      return res.status(200).json({ data: rows.map(formatAchievement) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getAllAchievements(req: Request, res: Response) {
    try {
      const data = this.service.getAllAchievements();
      return res.status(200).json({ data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  createAchievement(req: Request, res: Response) {
    try {
      const data = this.service.createAchievement(req.body);
      return res.status(201).json({ data, message: 'Achievement created' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  initializeDefaults(req: Request, res: Response) {
    try {
      this.service.initializeDefaults();
      return res.status(200).json({ message: 'Defaults initialized' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  recordGameResult(req: Request, res: Response) {
    try {
      const { sessionId, guildId, gameType, durationMs, results } =
        req.body as {
          sessionId: string;
          guildId: string;
          gameType: string;
          durationMs?: number;
          results: { userId: string; position: number }[];
        };

      if (
        !sessionId ||
        !guildId ||
        !gameType ||
        !Array.isArray(results) ||
        results.length === 0
      ) {
        return res.status(400).json({
          message: 'sessionId, guildId, gameType, and results are required',
        });
      }

      this.service.recordGameResult({
        sessionId,
        guildId,
        gameType,
        durationMs,
        results,
      });
      return res.status(200).json({ message: 'Game result recorded' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getUserGameStats(
    req: Request<
      UserGuildParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ) {
    try {
      const { userId, guildId } = req.params;
      const data = this.service.getUserGameStats(userId, guildId);
      return res.status(200).json({ data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getGameLeaderboard(
    req: Request<
      GuildGameTypeParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ) {
    try {
      const { guildId, gameType } = req.params;
      const data = this.service.getGameLeaderboard(guildId, gameType);
      return res.status(200).json({ data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default GamificationController;
