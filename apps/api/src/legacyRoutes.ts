import type { NestExpressApplication } from '@nestjs/platform-express';
import activityRouter from 'routes/activity.route';
import aiChatRouter from 'routes/aiChat.route';
import authRouter from 'routes/auth.route';
import emojiReactionRouter from 'routes/emojiReaction.route';
import evolutiveAchievementsRouter from 'routes/evolutiveAchievements.route';
import gamificationRouter from 'routes/gamification.route';
import mazeRouter from 'routes/maze.route';
import scrobbleRouter from 'routes/scrobble.route';
import userRouter from 'routes/user.route';
import wordleRouter from 'routes/wordle.route';

export function registerLegacyRoutes(app: NestExpressApplication): void {
  app.use('/api/activities', activityRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/user', userRouter);
  app.use('/api/scrobble', scrobbleRouter);
  app.use('/api/ai-chat', aiChatRouter);
  app.use('/api/emoji-reaction', emojiReactionRouter);
  app.use('/api/gamification', gamificationRouter);
  app.use('/api/evolutive-achievements', evolutiveAchievementsRouter);
  app.use('/api/games/maze', mazeRouter);
  app.use('/api/wordle', wordleRouter);
}
