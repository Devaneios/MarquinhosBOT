import * as contract from '@marquinhos/contracts/http/routes/evolutiveAchievements';
import type { Request, Response } from 'express';
import { EvolutiveAchievementsService } from 'services/evolutiveAchievements';
import { parseRequest, sendContract } from 'utils/contract';

const service = new EvolutiveAchievementsService();

export const evolutiveAchievements = {
  async checkAndEvolve(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.checkAndEvolve, req);
    if (!input) {
      res.status(400).json({ message: 'userId and guildId are required' });
      return;
    }
    const { userId, guildId } = input.params;
    try {
      const evolutions = await service.checkAndEvolveAll(userId, guildId);
      sendContract(res, contract.checkAndEvolve, { data: evolutions });
    } catch (error) {
      console.error('[evolutiveAchievements] checkAndEvolve error:', error);
      res.status(500).json({ message: 'Failed to check evolution' });
    }
  },

  async getUserEvolutiveAchievements(
    req: Request,
    res: Response,
  ): Promise<void> {
    const input = parseRequest(contract.getUserEvolutiveAchievements, req);
    if (!input) {
      res.status(400).json({ message: 'userId and guildId are required' });
      return;
    }
    const { userId, guildId } = input.params;
    try {
      const achievements = await service.getUserEvolutiveAchievements(
        userId,
        guildId,
      );
      sendContract(res, contract.getUserEvolutiveAchievements, {
        data: achievements,
      });
    } catch (error) {
      console.error(
        '[evolutiveAchievements] getUserEvolutiveAchievements error:',
        error,
      );
      res.status(500).json({ message: 'Failed to get evolutive achievements' });
    }
  },

  async getEvolutionTimeline(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.getEvolutionTimeline, req);
    if (!input) {
      res.status(400).json({ message: 'userId and guildId are required' });
      return;
    }
    const { userId, guildId } = input.params;
    try {
      const timeline = await service.getEvolutionTimeline(userId, guildId);
      sendContract(res, contract.getEvolutionTimeline, { data: timeline });
    } catch (error) {
      console.error(
        '[evolutiveAchievements] getEvolutionTimeline error:',
        error,
      );
      res.status(500).json({ message: 'Failed to get evolution timeline' });
    }
  },
};
