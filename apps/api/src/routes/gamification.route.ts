import GamificationController from 'controllers/gamification.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';

const router = express.Router();
const gamification = new GamificationController();

router.get(
  '/xp-config',
  checkToken,
  gamification.getXpConfig.bind(gamification),
);
router.post('/xp', checkToken, gamification.addXP.bind(gamification));
router.get(
  '/level/:userId/:guildId',
  checkToken,
  gamification.getUserLevel.bind(gamification),
);
router.get(
  '/leaderboard/:guildId',
  checkToken,
  gamification.getLeaderboard.bind(gamification),
);
router.post(
  '/achievement/unlock',
  checkToken,
  gamification.unlockAchievement.bind(gamification),
);
router.get(
  '/achievements/:userId/:guildId',
  checkToken,
  gamification.getUserAchievements.bind(gamification),
);
router.get(
  '/achievements',
  checkToken,
  gamification.getAllAchievements.bind(gamification),
);
router.post(
  '/achievements',
  checkToken,
  gamification.createAchievement.bind(gamification),
);
router.post(
  '/achievements/initialize',
  checkToken,
  gamification.initializeDefaults.bind(gamification),
);
router.post(
  '/game-result',
  checkToken,
  gamification.recordGameResult.bind(gamification),
);
router.get(
  '/game-stats/:userId/:guildId',
  checkToken,
  gamification.getUserGameStats.bind(gamification),
);
router.get(
  '/game-leaderboard/:guildId/:gameType',
  checkToken,
  gamification.getGameLeaderboard.bind(gamification),
);

export default router;
