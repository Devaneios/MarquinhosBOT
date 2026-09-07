import { describe, expect, it } from 'bun:test';
import { emojiReactionChooseSchema } from 'schemas/emojiReaction.schema';

describe('emojiReactionChooseSchema', () => {
  it('accepts a payload with just content', async () => {
    expect(
      emojiReactionChooseSchema.parseAsync({
        body: { content: 'kkkkk mano que hilário' },
        query: {},
        params: {},
      }),
    ).resolves.toBeDefined();
  });

  it('accepts a payload with recentMessages', async () => {
    expect(
      emojiReactionChooseSchema.parseAsync({
        body: {
          content: 'kkkkk',
          recentMessages: [{ author: 'ana', content: 'oi' }],
        },
        query: {},
        params: {},
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a payload missing content', async () => {
    expect(
      emojiReactionChooseSchema.parseAsync({
        body: {},
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects an empty content string', async () => {
    expect(
      emojiReactionChooseSchema.parseAsync({
        body: { content: '' },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects recentMessages longer than 10 entries', async () => {
    const recentMessages = Array.from({ length: 11 }, (_, i) => ({
      author: `user${i}`,
      content: 'msg',
    }));
    expect(
      emojiReactionChooseSchema.parseAsync({
        body: { content: 'oi', recentMessages },
        query: {},
        params: {},
      }),
    ).rejects.toThrow();
  });
});
