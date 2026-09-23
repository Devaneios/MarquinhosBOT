import { choose } from '@marquinhos/contracts/http/routes/emojiReaction';
import { describe, expect, it } from 'bun:test';

const accepts = (body: unknown) => choose.body.safeParse(body).success;

describe('emoji reaction choose body', () => {
  it('accepts a payload with just content', () => {
    expect(accepts({ content: 'kkkkk mano que hilário' })).toBe(true);
  });

  it('accepts a payload with recentMessages', () => {
    expect(
      accepts({
        content: 'kkkkk',
        recentMessages: [{ author: 'ana', content: 'oi' }],
      }),
    ).toBe(true);
  });

  it('rejects a payload missing content', () => {
    expect(accepts({})).toBe(false);
  });

  it('rejects an empty content string', () => {
    expect(accepts({ content: '' })).toBe(false);
  });

  it('rejects recentMessages longer than 10 entries', () => {
    const recentMessages = Array.from({ length: 11 }, (_, i) => ({
      author: `user${i}`,
      content: 'msg',
    }));
    expect(accepts({ content: 'oi', recentMessages })).toBe(false);
  });
});
