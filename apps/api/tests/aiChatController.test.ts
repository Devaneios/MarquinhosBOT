import { afterAll, describe, expect, it } from 'bun:test';
import { AiChatController } from 'modules/ai-chat/ai-chat.controller';
import { AiChatService } from 'modules/ai-chat/ai-chat.service';
import { ResearchOrchestrator } from 'modules/ai-chat/research/research-orchestrator.service';
import { AiThreadService } from 'modules/ai-chat/thread/ai-thread.service';
import { AiTraceQuery } from 'modules/ai-chat/trace/ai-trace-query';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';

const server = await startNestControllerServer({
  controllers: [AiChatController],
  providers: [
    {
      provide: AiChatService,
      useValue: {
        respond: async () => ({
          status: 'ok',
          category: 'casual_chat',
          reply: 'e aí',
        }),
      },
    },
    { provide: AiTraceQuery, useValue: {} },
    { provide: AiThreadService, useValue: {} },
    { provide: ResearchOrchestrator, useValue: {} },
  ],
});

afterAll(() => server.close());

describe('AiChatController.respond', () => {
  it('returns 200 with the service result as data', async () => {
    const response = await requestController(server, '/ai-chat/respond', {
      method: 'POST',
      body: {
        userId: 'u1',
        guildId: 'g1',
        channelId: 'c1',
        content: 'e aí',
        recentMessages: [],
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { status: 'ok', category: 'casual_chat', reply: 'e aí' },
    });
  });

  it('returns the route error body when the service throws', async () => {
    const failing = await startNestControllerServer({
      controllers: [AiChatController],
      providers: [
        {
          provide: AiChatService,
          useValue: {
            respond: async () => {
              throw new Error('db down');
            },
          },
        },
        { provide: AiTraceQuery, useValue: {} },
        { provide: AiThreadService, useValue: {} },
        { provide: ResearchOrchestrator, useValue: {} },
      ],
    });
    try {
      const response = await requestController(failing, '/ai-chat/respond', {
        method: 'POST',
        body: {
          userId: 'u1',
          guildId: 'g1',
          channelId: 'c1',
          content: 'oi',
          recentMessages: [],
        },
      });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Unknown Error' });
    } finally {
      await failing.close();
    }
  });
});
