import { Test } from '@nestjs/testing';
import { describe, it } from 'bun:test';
import 'reflect-metadata';

describe('Nest dependency graph', () => {
  it('compiles the app and each migrated feature module independently', async () => {
    const { AppModule } = await import('app.module');
    const { GamificationModule } =
      await import('modules/gamification/gamification.module');
    const { MazeModule } = await import('modules/maze/maze.module');
    const { WordleModule } = await import('modules/wordle/wordle.module');
    const { AiChatModule } = await import('modules/ai-chat/ai-chat.module');
    const { EmojiReactionModule } =
      await import('modules/emoji-reaction/emoji-reaction.module');
    const { ActivityModule } = await import('modules/activity/activity.module');
    const { AuthModule } = await import('modules/auth/auth.module');
    const { UserModule } = await import('modules/user/user.module');
    const { ScrobbleModule } = await import('modules/scrobble/scrobble.module');
    const { HealthModule } = await import('modules/health/health.module');
    const { PrivacyPolicyModule } =
      await import('modules/privacy-policy/privacy-policy.module');

    await Test.createTestingModule({ imports: [AppModule] }).compile();
    await Test.createTestingModule({ imports: [AuthModule] }).compile();
    await Test.createTestingModule({ imports: [UserModule] }).compile();
    await Test.createTestingModule({ imports: [ScrobbleModule] }).compile();
    await Test.createTestingModule({ imports: [HealthModule] }).compile();
    await Test.createTestingModule({
      imports: [PrivacyPolicyModule],
    }).compile();
    await Test.createTestingModule({ imports: [GamificationModule] }).compile();
    await Test.createTestingModule({ imports: [MazeModule] }).compile();
    await Test.createTestingModule({ imports: [WordleModule] }).compile();
    await Test.createTestingModule({ imports: [AiChatModule] }).compile();
    await Test.createTestingModule({
      imports: [EmojiReactionModule],
    }).compile();
    await Test.createTestingModule({ imports: [ActivityModule] }).compile();
  });
});
