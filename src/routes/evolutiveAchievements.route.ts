import { evolutiveAchievements } from 'controllers/evolutiveAchievements.controller';
import type express from 'express';
import { Router } from 'express';
import { checkToken } from 'middlewares/botAuth';

const router = Router();

router.post(
  '/evolve/:userId/:guildId',
  checkToken,
  evolutiveAchievements.checkAndEvolve.bind(
    evolutiveAchievements,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/:userId/:guildId',
  checkToken,
  evolutiveAchievements.getUserEvolutiveAchievements.bind(
    evolutiveAchievements,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/timeline/:userId/:guildId',
  checkToken,
  evolutiveAchievements.getEvolutionTimeline.bind(
    evolutiveAchievements,
  ) as unknown as express.RequestHandler,
);

export default router;
