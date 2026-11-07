import type { NestExpressApplication } from '@nestjs/platform-express';
import activityRouter from 'routes/activity.route';
import aiChatRouter from 'routes/aiChat.route';
import emojiReactionRouter from 'routes/emojiReaction.route';
import wordleRouter from 'routes/wordle.route';

export function registerLegacyRoutes(app: NestExpressApplication): void {
  app.use('/api/activities', activityRouter);
  app.use('/api/ai-chat', aiChatRouter);
  app.use('/api/emoji-reaction', emojiReactionRouter);
  app.use('/api/wordle', wordleRouter);
}
