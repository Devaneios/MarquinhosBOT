import { respond } from '@marquinhos/contracts/http/routes/aiChat';
import { describe, expect, it } from 'bun:test';

const accepts = (body: unknown) => respond.body.safeParse(body).success;

describe('respond body', () => {
  it('accepts a valid payload', () => {
    expect(
      accepts({
        userId: 'u1',
        guildId: 'g1',
        channelId: 'c1',
        content: 'oi',
        recentMessages: [{ author: 'ana', content: 'oi' }],
      }),
    ).toBe(true);
  });

  it('rejects a payload missing content', () => {
    expect(
      accepts({
        userId: 'u1',
        guildId: 'g1',
        channelId: 'c1',
        recentMessages: [],
      }),
    ).toBe(false);
  });

  it('rejects recentMessages longer than 20 entries', () => {
    const recentMessages = Array.from({ length: 21 }, (_, i) => ({
      author: `user${i}`,
      content: 'msg',
    }));
    expect(
      accepts({
        userId: 'u1',
        guildId: 'g1',
        channelId: 'c1',
        content: 'oi',
        recentMessages,
      }),
    ).toBe(false);
  });
});
