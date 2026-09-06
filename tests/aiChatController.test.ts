import { describe, expect, it } from 'bun:test';
import AiChatController from 'controllers/aiChat.controller';
import type { AiChatService } from 'services/aiChat/AiChatService';

function makeReq(body: Record<string, unknown>) {
  return { body } as any;
}

function makeRes() {
  let statusCode: number | undefined;
  let payload: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: unknown) {
      payload = data;
      return res;
    },
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
  return res;
}

describe('AiChatController.respond', () => {
  it('returns 200 with the service result as data', async () => {
    const fakeService = {
      respond: async () => ({
        status: 'ok',
        category: 'casual_chat',
        reply: 'e aí',
      }),
    } as unknown as AiChatService;
    const controller = new AiChatController(fakeService);

    const req = makeReq({
      userId: 'u1',
      guildId: 'g1',
      channelId: 'c1',
      content: 'e aí',
      recentMessages: [],
    });
    const res = makeRes();

    await controller.respond(req, res as any);

    expect(res.getStatus()).toBe(200);
    expect(res.getPayload()).toEqual({
      data: { status: 'ok', category: 'casual_chat', reply: 'e aí' },
    });
  });

  it('returns 500 when the service throws', async () => {
    const fakeService = {
      respond: async () => {
        throw new Error('db down');
      },
    } as unknown as AiChatService;
    const controller = new AiChatController(fakeService);

    const req = makeReq({
      userId: 'u1',
      guildId: 'g1',
      channelId: 'c1',
      content: 'oi',
      recentMessages: [],
    });
    const res = makeRes();

    await controller.respond(req, res as any);

    expect(res.getStatus()).toBe(500);
  });
});
