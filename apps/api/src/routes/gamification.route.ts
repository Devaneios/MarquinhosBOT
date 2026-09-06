import GamificationController from 'controllers/gamification.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';

const router = express.Router();
const gamification = new GamificationController();

router.get(
  '/xp-config',
  checkToken,
  gamification.getXpConfig.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);
router.post(
  '/xp',
  checkToken,
  gamification.addXP.bind(gamification) as unknown as express.RequestHandler,
);
router.get(
  '/level/:userId/:guildId',
  checkToken,
  gamification.getUserLevel.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/leaderboard/:guildId',
  checkToken,
  gamification.getLeaderboard.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);
router.post(
  '/achievement/unlock',
  checkToken,
  gamification.unlockAchievement.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/achievements/:userId/:guildId',
  checkToken,
  gamification.getUserAchievements.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/achievements',
  checkToken,
  gamification.getAllAchievements.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);
router.post(
  '/achievements',
  checkToken,
  gamification.createAchievement.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);
router.post(
  '/achievements/initialize',
  checkToken,
  gamification.initializeDefaults.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);
router.post(
  '/game-result',
  checkToken,
  gamification.recordGameResult.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/game-stats/:userId/:guildId',
  checkToken,
  gamification.getUserGameStats.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/game-leaderboard/:guildId/:gameType',
  checkToken,
  gamification.getGameLeaderboard.bind(
    gamification,
  ) as unknown as express.RequestHandler,
);

export default router;
