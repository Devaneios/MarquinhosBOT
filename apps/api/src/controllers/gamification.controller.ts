import * as contract from '@marquinhos/contracts/http/routes/gamification';
import type { Request, Response } from 'express';
import type {
  AddXpResult,
  UserAchievement,
  UserLevel,
} from 'services/gamification';
import { GamificationService } from 'services/gamification';
import { parseRequest, sendContract } from 'utils/contract';

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
      return sendContract(res, contract.getXpConfig, { data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  addXP(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.addXp, req);
      if (!input) {
        return res
          .status(400)
          .json({ message: 'userId, guildId, and eventType are required' });
      }
      const { userId, guildId, eventType } = input.body;

      const result = this.service.addXP(userId, guildId, eventType);
      const data = formatAddXpResult(result);
      return sendContract(res, contract.addXp, {
        data,
        message: result.onCooldown ? 'On cooldown' : 'XP added',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getUserLevel(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.getUserLevel, req);
      if (!input) {
        return res
          .status(400)
          .json({ message: 'userId and guildId are required' });
      }
      const { userId, guildId } = input.params;
      const row = this.service.getUserLevel(userId, guildId);
      return sendContract(res, contract.getUserLevel, {
        data: formatLevel(row),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getLeaderboard(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.getLeaderboard, req);
      if (!input) {
        return res.status(400).json({ message: 'guildId is required' });
      }
      const { guildId } = input.params;
      const limit = Math.min(input.query.limit, 25);
      const rows = this.service.getLeaderboard(guildId, limit);
      return sendContract(res, contract.getLeaderboard, {
        data: rows.map(formatLevel),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  unlockAchievement(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.unlockAchievement, req);
      if (!input) {
        return res
          .status(400)
          .json({ message: 'userId, guildId, and achievementId are required' });
      }
      const { userId, guildId, achievementId } = input.body;

      const unlocked = this.service.unlockAchievement(
        userId,
        guildId,
        achievementId,
      );
      return sendContract(res, contract.unlockAchievement, {
        data: { unlocked },
        message: unlocked ? 'Achievement unlocked' : 'Already unlocked',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getUserAchievements(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.getUserAchievements, req);
      if (!input) {
        return res
          .status(400)
          .json({ message: 'userId and guildId are required' });
      }
      const { userId, guildId } = input.params;
      const rows = this.service.getUserAchievements(userId, guildId);
      return sendContract(res, contract.getUserAchievements, {
        data: rows.map(formatAchievement),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getAllAchievements(req: Request, res: Response) {
    try {
      const data = this.service.getAllAchievements();
      return sendContract(res, contract.getAllAchievements, { data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  createAchievement(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.createAchievement, req);
      if (!input) {
        return res.status(400).json({ message: 'Invalid achievement' });
      }
      const data = this.service.createAchievement(input.body);
      return sendContract(
        res,
        contract.createAchievement,
        { data, message: 'Achievement created' },
        201,
      );
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  initializeDefaults(req: Request, res: Response) {
    try {
      this.service.initializeDefaults();
      return sendContract(res, contract.initializeDefaults, {
        message: 'Defaults initialized',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  recordGameResult(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.recordGameResult, req);
      if (!input) {
        return res.status(400).json({
          message: 'sessionId, guildId, gameType, and results are required',
        });
      }

      this.service.recordGameResult(input.body);
      return sendContract(res, contract.recordGameResult, {
        message: 'Game result recorded',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getUserGameStats(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.getUserGameStats, req);
      if (!input) {
        return res
          .status(400)
          .json({ message: 'userId and guildId are required' });
      }
      const { userId, guildId } = input.params;
      const data = this.service.getUserGameStats(userId, guildId);
      return sendContract(res, contract.getUserGameStats, { data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getGameLeaderboard(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.getGameLeaderboard, req);
      if (!input) {
        return res
          .status(400)
          .json({ message: 'guildId and gameType are required' });
      }
      const { guildId, gameType } = input.params;
      const data = this.service.getGameLeaderboard(guildId, gameType);
      return sendContract(res, contract.getGameLeaderboard, { data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default GamificationController;
