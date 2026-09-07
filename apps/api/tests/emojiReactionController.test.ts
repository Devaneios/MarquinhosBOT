import { describe, expect, it } from 'bun:test';
import EmojiReactionController from 'controllers/emojiReaction.controller';
import type { EmojiReactionService } from 'services/aiChat/EmojiReactionService';

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

describe('EmojiReactionController.choose', () => {
  it('returns 200 with the emojis as data', async () => {
    const fakeService = {
      chooseReactions: async () => ['😀', 'cavaloemoji:725868757779742787'],
    } as unknown as EmojiReactionService;
    const controller = new EmojiReactionController(fakeService);

    const req = makeReq({ content: 'kkkkk' });
    const res = makeRes();

    await controller.choose(req, res as any);

    expect(res.getStatus()).toBe(200);
    expect(res.getPayload()).toEqual({
      data: { emojis: ['😀', 'cavaloemoji:725868757779742787'] },
    });
  });

  it('returns 500 when the service throws', async () => {
    const fakeService = {
      chooseReactions: async () => {
        throw new Error('openai down');
      },
    } as unknown as EmojiReactionService;
    const controller = new EmojiReactionController(fakeService);

    const req = makeReq({ content: 'kkkkk' });
    const res = makeRes();

    await controller.choose(req, res as any);

    expect(res.getStatus()).toBe(500);
  });
});
