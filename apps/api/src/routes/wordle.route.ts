import WordleController from 'controllers/wordle.controller';
import { db } from 'database/sqlite';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';
import { verifyActivityDiscordToken } from 'middlewares/userAuth';
import { WordleUserConfigService } from 'services/wordleUserConfig';

const router = express.Router();
const wordle = new WordleController(new WordleUserConfigService(db));

router.get('/user-config', verifyActivityDiscordToken, (req, res) =>
  wordle.getUserConfig(req, res),
);
router.put('/user-config', verifyActivityDiscordToken, (req, res) =>
  wordle.updateUserConfig(req, res),
);

router.post(
  '/guess',
  checkToken,
  wordle.submitGuess.bind(wordle) as unknown as express.RequestHandler,
);
router.get(
  '/stats/:guildId',
  checkToken,
  wordle.getStats.bind(wordle) as unknown as express.RequestHandler,
);
router.get(
  '/session/:userId/:guildId',
  checkToken,
  wordle.getUserSession.bind(wordle) as unknown as express.RequestHandler,
);
router.get(
  '/day-guesses/:guildId',
  checkToken,
  wordle.getDayGuesses.bind(wordle) as unknown as express.RequestHandler,
);
router.post(
  '/admin/force-new-word',
  checkToken,
  wordle.forceNewWord.bind(wordle) as unknown as express.RequestHandler,
);
router.get(
  '/leaderboard/:guildId',
  checkToken,
  wordle.getLeaderboard.bind(wordle) as unknown as express.RequestHandler,
);
router.get(
  '/validate/:guildId',
  checkToken,
  wordle.validateGuess.bind(wordle) as unknown as express.RequestHandler,
);
router.post(
  '/config',
  checkToken,
  wordle.setConfig.bind(wordle) as unknown as express.RequestHandler,
);
router.get(
  '/config/:guildId',
  checkToken,
  wordle.getConfig.bind(wordle) as unknown as express.RequestHandler,
);
router.post(
  '/mark-announced',
  checkToken,
  wordle.markAnnounced.bind(wordle) as unknown as express.RequestHandler,
);
router.get(
  '/unannounced/:guildId',
  checkToken,
  wordle.getUnannouncedWins.bind(wordle) as unknown as express.RequestHandler,
);
router.get(
  '/streak/:userId/:guildId',
  checkToken,
  wordle.getStreak.bind(wordle) as unknown as express.RequestHandler,
);
router.get(
  '/wordlist-pool-stats',
  checkToken,
  wordle.getWordlistPoolStats.bind(wordle) as unknown as express.RequestHandler,
);
router.get(
  '/review/next',
  checkToken,
  wordle.getNextReviewWord.bind(wordle) as unknown as express.RequestHandler,
);
router.post(
  '/review/decision',
  checkToken,
  wordle.submitReviewDecision.bind(wordle) as unknown as express.RequestHandler,
);

export default router;
