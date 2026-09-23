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

router.post('/guess', checkToken, wordle.submitGuess.bind(wordle));
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
