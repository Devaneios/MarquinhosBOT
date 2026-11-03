import { db } from '@marquinhos/database/client';
import WordleController from 'controllers/wordle.controller';
import { WordleAlbumController } from 'controllers/wordleAlbum.controller';
import { WordleChallengesController } from 'controllers/wordleChallenges.controller';
import { WordleGoalsController } from 'controllers/wordleGoals.controller';
import { WordleNotificationsController } from 'controllers/wordleNotifications.controller';
import { WordleRewardsController } from 'controllers/wordleRewards.controller';
import { WordleShowcaseController } from 'controllers/wordleShowcase.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';
import { requireGuildMember } from 'middlewares/guildMembership';
import { verifyActivityDiscordToken } from 'middlewares/userAuth';
import { DiscordService } from 'services/discord';
import { WordleAlbumService } from 'services/wordle/WordleAlbumService';
import { WordleChallengeService } from 'services/wordle/WordleChallengeService';
import { WordleGoalsService } from 'services/wordle/WordleGoalsService';
import { WordleNotificationService } from 'services/wordle/WordleNotificationService';
import { WordleRewardsService } from 'services/wordle/WordleRewardsService';
import { WordleShowcaseService } from 'services/wordle/WordleShowcaseService';
import { WordleUserConfigService } from 'services/wordleUserConfig';

const router = express.Router();
const wordle = new WordleController(new WordleUserConfigService(db));
const showcase = new WordleShowcaseController(new WordleShowcaseService(db));
const rewards = new WordleRewardsController(new WordleRewardsService(db));
const notifications = new WordleNotificationsController(
  new WordleNotificationService(db),
);

router.get('/admin/notifications/:guildId', checkToken, (req, res) =>
  notifications.config(req, res),
);
router.put('/admin/notifications/:guildId', checkToken, (req, res) =>
  notifications.configure(req, res),
);
router.post('/admin/notifications/:guildId/claim', checkToken, (req, res) =>
  notifications.claim(req, res),
);
router.post('/admin/notifications/:guildId/settle', checkToken, (req, res) =>
  notifications.settle(req, res),
);
router.get('/admin/notifications/:guildId/uncertain', checkToken, (req, res) =>
  notifications.uncertain(req, res),
);
router.post('/admin/notifications/:guildId/resolve', checkToken, (req, res) =>
  notifications.resolve(req, res),
);
const goals = new WordleGoalsController(new WordleGoalsService(db));
const verifyGuildMember = requireGuildMember(
  new DiscordService().isGuildMember,
);
const challenges = new WordleChallengesController(
  new WordleChallengeService(db),
);
router.get(
  '/challenges/:guildId',
  verifyActivityDiscordToken,
  verifyGuildMember,
  (req, res) => challenges.list(req, res),
);
router.post(
  '/challenges/:guildId',
  verifyActivityDiscordToken,
  verifyGuildMember,
  (req, res) => challenges.create(req, res),
);
router.post(
  '/challenges/:guildId/:challengeId/join',
  verifyActivityDiscordToken,
  verifyGuildMember,
  (req, res) => challenges.join(req, res),
);

router.get(
  '/goals/:guildId',
  verifyActivityDiscordToken,
  verifyGuildMember,
  (req, res) => goals.list(req.params.guildId, res),
);
router.post('/admin/goals', checkToken, (req, res) => goals.create(req, res));
const album = new WordleAlbumController(new WordleAlbumService(db));

router.get(
  '/album/:guildId',
  verifyActivityDiscordToken,
  verifyGuildMember,
  (req, res) => album.get(req.params.guildId, res),
);

router.get('/showcase', verifyActivityDiscordToken, (req, res) =>
  showcase.get(req, res),
);
router.get('/rewards', verifyActivityDiscordToken, (req, res) =>
  rewards.get(req, res),
);
router.put('/rewards', verifyActivityDiscordToken, (req, res) =>
  rewards.update(req, res),
);
router.put('/showcase', verifyActivityDiscordToken, (req, res) =>
  showcase.update(req, res),
);

router.get('/user-config', verifyActivityDiscordToken, (req, res) =>
  wordle.getUserConfig(req, res),
);
router.put('/user-config', verifyActivityDiscordToken, (req, res) =>
  wordle.updateUserConfig(req, res),
);

router.post('/guess', checkToken, wordle.submitGuess.bind(wordle));
router.post('/presence', checkToken, wordle.recordPresence.bind(wordle));
router.post('/draft', checkToken, wordle.writeDraft.bind(wordle));
router.post('/rotate', checkToken, wordle.rotateDailyWord.bind(wordle));
router.get(
  '/achievements/:guildId/:userId',
  checkToken,
  wordle.getAchievements.bind(wordle),
);
router.get('/stats/:guildId', checkToken, wordle.getStats.bind(wordle));
router.get(
  '/session/:userId/:guildId',
  checkToken,
  wordle.getUserSession.bind(wordle),
);
router.get(
  '/day-guesses/:guildId',
  checkToken,
  wordle.getDayGuesses.bind(wordle),
);
router.post(
  '/admin/force-new-word',
  checkToken,
  wordle.forceNewWord.bind(wordle),
);
router.get(
  '/leaderboard/:guildId',
  checkToken,
  wordle.getLeaderboard.bind(wordle),
);
router.get('/validate/:guildId', checkToken, wordle.validateGuess.bind(wordle));
router.post('/config', checkToken, wordle.setConfig.bind(wordle));
router.get('/config/:guildId', checkToken, wordle.getConfig.bind(wordle));
router.post('/mark-announced', checkToken, wordle.markAnnounced.bind(wordle));
router.get(
  '/unannounced/:guildId',
  checkToken,
  wordle.getUnannouncedWins.bind(wordle),
);
router.get(
  '/streak/:userId/:guildId',
  checkToken,
  wordle.getStreak.bind(wordle),
);
router.get(
  '/wordlist-pool-stats',
  checkToken,
  wordle.getWordlistPoolStats.bind(wordle),
);
router.get('/review/next', checkToken, wordle.getNextReviewWord.bind(wordle));
router.post(
  '/review/decision',
  checkToken,
  wordle.submitReviewDecision.bind(wordle),
);

export default router;
