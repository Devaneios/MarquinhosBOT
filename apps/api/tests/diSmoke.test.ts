import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'bun:test';
import 'reflect-metadata';

describe('Nest dependency graph', () => {
  it('builds emoji reactions without the AI chat graph', async () => {
    const { EmojiReactionModule } =
      await import('modules/emoji-reaction/emoji-reaction.module');
    const { EmojiReactionService } =
      await import('modules/emoji-reaction/emoji-reaction.service');
    const { SandboxManager } =
      await import('modules/ai-chat/sandbox/sandbox-manager.service');
    const moduleRef = await Test.createTestingModule({
      imports: [EmojiReactionModule],
    }).compile();
    expect(moduleRef.get(EmojiReactionService)).toBeDefined();
    expect(() => moduleRef.get(SandboxManager, { strict: false })).toThrow();
  });

  it("dispatches with the module's tool list", async () => {
    const { AiChatModule } = await import('modules/ai-chat/ai-chat.module');
    const { ToolDispatcher } =
      await import('modules/ai-chat/agent/tool-dispatcher');
    const { AI_AGENT_TOOLS } = await import('modules/ai-chat/ai-chat.tokens');
    const moduleRef = await Test.createTestingModule({
      imports: [AiChatModule],
    }).compile();
    expect(moduleRef.get(ToolDispatcher).tools).toBe(
      moduleRef.get(AI_AGENT_TOOLS),
    );
  });

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
