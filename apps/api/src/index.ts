import { WebSocketTransport } from '@colyseus/ws-transport';
import '@marquinhos/database/sqlite';
import { Server as ColyseusServer } from 'colyseus';
import { validateProductionEnvironment } from 'config/environment';
import cors from 'cors';
import type { Express, NextFunction, Request, Response } from 'express';
import express from 'express';
import http from 'http';
import morgan from 'morgan';
import { MatchRoom } from 'realtime/MatchRoom';
import activityRouter from 'routes/activity.route';
import aiChatRouter from 'routes/aiChat.route';
import * as auth from 'routes/auth.route';
import emojiReactionRouter from 'routes/emojiReaction.route';
import evolutiveAchievementsRouter from 'routes/evolutiveAchievements.route';
import gamificationRouter from 'routes/gamification.route';
import healthRouter from 'routes/health.route';
import mazeRouter from 'routes/maze.route';
import * as privacyPolicy from 'routes/privacyPolicy.route';
import * as scrobble from 'routes/scrobble.route';
import * as user from 'routes/user.route';
import wordleRouter from 'routes/wordle.route';
import {
  AGENT_DAILY_QUOTA,
  DailyQuotaService,
  RESEARCH_DAILY_QUOTA,
} from 'services/aiChat/DailyQuotaService';
import { describeStaticPrompts } from 'services/aiChat/promptRegistry';
import { RateLimitService } from 'services/aiChat/RateLimitService';
import { ResearchOrchestrator } from 'services/aiChat/research/ResearchOrchestrator';
import { DockerodeSandboxClient } from 'services/aiChat/sandbox/DockerodeSandboxClient';
import { SandboxManager } from 'services/aiChat/sandbox/SandboxManager';
import { GamificationService } from 'services/gamification';
import { getValidationSet } from 'services/wordle';
import { logger } from 'utils/logger';

validateProductionEnvironment();

const app: Express = express();

// Requests arrive through a single reverse-proxy hop (tunnel) in front of
// this process, which sets X-Forwarded-For — trust exactly that one hop so
// express-rate-limit keys off the real client IP instead of the tunnel's.
app.set('trust proxy', 1);

const allowlist = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptionsDelegate = function (req: Request, callback: Function) {
  let corsOptions;
  if (allowlist.indexOf(req.header('Origin') ?? '') !== -1) {
    corsOptions = {
      origin: true,
      credentials: true,
    };
  } else {
    corsOptions = {
      origin: false,
      credentials: true,
    };
  }
  callback(null, corsOptions);
};

app.use(
  morgan(
    ':remote-addr :remote-user :method :url HTTP/:http-version :status :res[content-length] - :response-time ms',
  ),
);

app.use(express.json());
app.use(cors(corsOptionsDelegate));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — global 100 req/15min, tighter limits on sensitive endpoints
// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { message: 'Too many requests, please try again later.' },
// });

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { message: 'Too many login attempts, please try again later.' },
// });

// const wordleLimiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: 20,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { message: 'Too many guesses, slow down.' },
// });

// app.use(globalLimiter);
// // Specific limiters registered before the catch-all route mounts
// app.use('/api/auth/login', authLimiter);
// app.use('/api/wordle/guess', wordleLimiter);

app.use('/api/health', healthRouter);

app.use('/api/activities', activityRouter);
app.use('/api/auth', auth.default);
app.use('/api/user', user.default);
app.use('/api/scrobble', scrobble.default);
app.use('/api/privacy-policy', privacyPolicy.default);
app.use('/api/ai-chat', aiChatRouter);
app.use('/api/emoji-reaction', emojiReactionRouter);
app.use('/api/gamification', gamificationRouter);
app.use('/api/evolutive-achievements', evolutiveAchievementsRouter);
app.use('/api/games/maze', mazeRouter);
app.use('/api/wordle', wordleRouter);

// --- 404 catch-all for unmatched routes ---
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// --- Global error handler (must be 4-arg for Express to treat it as error middleware) ---
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message,
  });
});

// Startup initialisation — failures crash the process instead of silently
// serving with empty XP config or missing wordle word list.
import { runMigrations } from '@marquinhos/database/migrate';

try {
  runMigrations();
  new GamificationService().initializeDefaults();
  new RateLimitService().seedDefaults();
  new DailyQuotaService(AGENT_DAILY_QUOTA).seedDefaults();
  new DailyQuotaService(RESEARCH_DAILY_QUOTA).seedDefaults();
  // A research job lives in this process, so a restart orphans anything still
  // queued or running. Fail those now instead of leaving the bot polling a job
  // that will never move.
  new ResearchOrchestrator().reapStaleJobs();
} catch (err) {
  console.error('Fatal: gamification initialization failed', err);
  process.exit(1);
}

const SANDBOX_SWEEP_INTERVAL_MS = 5 * 60_000;
const sandboxManager = new SandboxManager(new DockerodeSandboxClient());
setInterval(() => {
  sandboxManager.sweepIdleSessions().catch((err) => {
    logger.error('sandbox.sweep_failed', { error: err });
  });
}, SANDBOX_SWEEP_INTERVAL_MS);

// Traces reference static prompts by id + hash instead of repeating their full
// text on every request; this is the one place that maps those ids back.
logger.info('ai.prompts.loaded', { prompts: describeStaticPrompts() });

try {
  // Pre-warm the validation word set to avoid latency on first guess
  getValidationSet();
} catch (err) {
  console.error('Fatal: wordle validation set failed to load', err);
  process.exit(1);
}

const httpServer = http.createServer(app);

const gameServer = new ColyseusServer({
  transport: new WebSocketTransport({ server: httpServer }),
});
gameServer.define('match', MatchRoom).filterBy(['roomKey']);

void gameServer.listen(Number(process.env.HTTP_PORT) || 3000);
