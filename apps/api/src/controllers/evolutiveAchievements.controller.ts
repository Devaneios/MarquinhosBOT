import type { Request, Response } from 'express';
import { EvolutiveAchievementsService } from 'services/evolutiveAchievements';

const service = new EvolutiveAchievementsService();

interface UserGuildParams {
  userId: string;
  guildId: string;
}

export const evolutiveAchievements = {
  checkAndEvolve(
    req: Request<
      UserGuildParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): void {
    const { userId, guildId } = req.params;
    try {
      const evolutions = service.checkAndEvolveAll(userId, guildId);
      res.json({ data: evolutions });
    } catch (error) {
      console.error('[evolutiveAchievements] checkAndEvolve error:', error);
      res.status(500).json({ message: 'Failed to check evolution' });
    }
  },

  getUserEvolutiveAchievements(
    req: Request<
      UserGuildParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): void {
    const { userId, guildId } = req.params;
    try {
      const achievements = service.getUserEvolutiveAchievements(
        userId,
        guildId,
      );
      res.json({ data: achievements });
    } catch (error) {
      console.error(
        '[evolutiveAchievements] getUserEvolutiveAchievements error:',
        error,
      );
      res.status(500).json({ message: 'Failed to get evolutive achievements' });
    }
  },

  getEvolutionTimeline(
    req: Request<
      UserGuildParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): void {
    const { userId, guildId } = req.params;
    try {
      const timeline = service.getEvolutionTimeline(userId, guildId);
      res.json({ data: timeline });
    } catch (error) {
      console.error(
        '[evolutiveAchievements] getEvolutionTimeline error:',
        error,
      );
      res.status(500).json({ message: 'Failed to get evolution timeline' });
    }
  },
};
