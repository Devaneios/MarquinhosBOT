import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppConfig } from 'config/app.config';
import type { NextFunction, Request, Response } from 'express';
import activityRouter from 'routes/activity.route';
import aiChatRouter from 'routes/aiChat.route';
import authRouter from 'routes/auth.route';
import emojiReactionRouter from 'routes/emojiReaction.route';
import evolutiveAchievementsRouter from 'routes/evolutiveAchievements.route';
import gamificationRouter from 'routes/gamification.route';
import healthRouter from 'routes/health.route';
import mazeRouter from 'routes/maze.route';
import privacyPolicyRouter from 'routes/privacyPolicy.route';
import scrobbleRouter from 'routes/scrobble.route';
import userRouter from 'routes/user.route';
import wordleRouter from 'routes/wordle.route';
import { logger } from 'utils/logger';

export function registerLegacyRoutes(app: NestExpressApplication): void {
  app.use('/api/health', healthRouter);
  app.use('/api/activities', activityRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/user', userRouter);
  app.use('/api/scrobble', scrobbleRouter);
  app.use('/api/privacy-policy', privacyPolicyRouter);
  app.use('/api/ai-chat', aiChatRouter);
  app.use('/api/emoji-reaction', emojiReactionRouter);
  app.use('/api/gamification', gamificationRouter);
  app.use('/api/evolutive-achievements', evolutiveAchievementsRouter);
  app.use('/api/games/maze', mazeRouter);
  app.use('/api/wordle', wordleRouter);

  const config = app.get(AppConfig);
  app.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      if (res.headersSent) {
        next(error);
        return;
      }
      logger.error('http.unhandled_error', { error });
      const message = config.isProduction
        ? 'Internal Server Error'
        : error instanceof Error
          ? error.message
          : String(error);
      res.status(500).json({ message });
    },
  );
}
