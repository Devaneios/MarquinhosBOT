import { evolutiveAchievements } from 'controllers/evolutiveAchievements.controller';
import { Router } from 'express';
import { checkToken } from 'middlewares/botAuth';

const router = Router();

router.post(
  '/evolve/:userId/:guildId',
  checkToken,
  evolutiveAchievements.checkAndEvolve.bind(evolutiveAchievements),
);
router.get(
  '/:userId/:guildId',
  checkToken,
  evolutiveAchievements.getUserEvolutiveAchievements.bind(
    evolutiveAchievements,
  ),
);
router.get(
  '/timeline/:userId/:guildId',
  checkToken,
  evolutiveAchievements.getEvolutionTimeline.bind(evolutiveAchievements),
);

export default router;
