import type { Request, Response } from 'express';
import { userGuildParamsSchema } from 'schemas/gamification.schema';
import { EvolutiveAchievementsService } from 'services/evolutiveAchievements';

const service = new EvolutiveAchievementsService();

export const evolutiveAchievements = {
  checkAndEvolve(req: Request, res: Response): void {
    const params = userGuildParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'userId and guildId are required' });
      return;
    }
    const { userId, guildId } = params.data;
    try {
      const evolutions = service.checkAndEvolveAll(userId, guildId);
      res.json({ data: evolutions });
    } catch (error) {
      console.error('[evolutiveAchievements] checkAndEvolve error:', error);
      res.status(500).json({ message: 'Failed to check evolution' });
    }
  },

  getUserEvolutiveAchievements(req: Request, res: Response): void {
    const params = userGuildParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'userId and guildId are required' });
      return;
    }
    const { userId, guildId } = params.data;
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

  getEvolutionTimeline(req: Request, res: Response): void {
    const params = userGuildParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'userId and guildId are required' });
      return;
    }
    const { userId, guildId } = params.data;
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
