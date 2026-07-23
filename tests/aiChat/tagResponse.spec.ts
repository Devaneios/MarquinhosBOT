import { describe, expect, it } from 'bun:test';
import { GuildConfig } from '@marquinhos/config/guild';
import { handleTagResponse } from '@marquinhos/services/aiChat/tagResponse';
import type { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';

function makeMessage(
  overrides: Partial<{
    content: string;
    guildId: string | null;
    channelId: string;
    mentionsBot: boolean;
    recentMessages: { author: { username: string; bot?: boolean }; content: string }[];
  }> = {},
) {
  const replies: string[] = [];
  const typingCalls: number[] = [];
  return {
    content: overrides.content ?? '<@123456789012345678> oi',
    author: { id: 'user1' },
    guildId: overrides.guildId ?? GuildConfig.DEVANEIOS_GUILD_ID,
    channelId: overrides.channelId ?? GuildConfig.DEVANEIOS_CHANNEL_ID,
    client: { user: { id: 'bot1' } },
    mentions: { has: () => overrides.mentionsBot ?? true },
    channel: {
      sendTyping: async () => {
        typingCalls.push(1);
      },
      messages: {
        fetch: async () =>
          new Map((overrides.recentMessages ?? []).map((m, i) => [String(i), m])),
      },
    },
    reply: async (text: string) => {
      replies.push(text);
    },
    replies,
    typingCalls,
  };
}

function fakeApiService(
  respondToTag: MarquinhosApiService['respondToTag'],
): Pick<MarquinhosApiService, 'respondToTag'> {
  return { respondToTag };
}

describe('handleTagResponse', () => {
  it('does nothing when the message is not in the Devaneios channel', async () => {
    let called = false;
    const message = makeMessage({ channelId: 'some-other-channel' });
    const api = fakeApiService(async () => {
      called = true;
      return { data: { status: 'ok', reply: 'x' } };
    });
    await handleTagResponse(message, api);
    expect(message.replies.length).toBe(0);
    expect(called).toBe(false);
  });

  it('does nothing when the bot is not mentioned', async () => {
    const message = makeMessage({ mentionsBot: false });
    const api = fakeApiService(async () => ({ data: { status: 'ok', reply: 'x' } }));
    await handleTagResponse(message, api);
    expect(message.replies.length).toBe(0);
  });

  it('replies with a canned greeting and skips the backend call', async () => {
    let called = false;
    const message = makeMessage({ content: '<@123456789012345678> oi' });
    const api = fakeApiService(async () => {
      called = true;
      return { data: { status: 'ok', reply: 'x' } };
    });
    await handleTagResponse(message, api);
    expect(message.replies.length).toBe(1);
    expect(called).toBe(false);
  });

  it('replies with a canned length-gate message and skips the backend call for long content', async () => {
    let called = false;
    const longContent = '<@123456789012345678> ' + 'a'.repeat(150);
    const message = makeMessage({ content: longContent });
    const api = fakeApiService(async () => {
      called = true;
      return { data: { status: 'ok', reply: 'x' } };
    });
    await handleTagResponse(message, api);
    expect(message.replies.length).toBe(1);
    expect(called).toBe(false);
  });

  it('calls the backend and replies with its reply text for a normal tag', async () => {
    const message = makeMessage({ content: '<@123456789012345678> qual a capital do brasil?' });
    const api = fakeApiService(async () => ({
      data: { status: 'ok', category: 'general_question', reply: 'Brasília.' },
    }));
    await handleTagResponse(message, api);
    expect(message.replies).toEqual(['Brasília.']);
    expect(message.typingCalls.length).toBe(1);
  });

  it('replies with the rate-limited message when the backend reports rate_limited', async () => {
    const message = makeMessage({ content: '<@123456789012345678> qual a capital do brasil?' });
    const api = fakeApiService(async () => ({ data: { status: 'rate_limited' } }));
    await handleTagResponse(message, api);
    expect(message.replies).toEqual(['Marquinhos está cansado, volte amanhã']);
  });

  it('replies with a canned fallback when the backend reports error', async () => {
    const message = makeMessage({ content: '<@123456789012345678> qual a capital do brasil?' });
    const api = fakeApiService(async () => ({ data: { status: 'error' } }));
    await handleTagResponse(message, api);
    expect(message.replies.length).toBe(1);
  });

  it('replies with a canned fallback when the backend call throws', async () => {
    const message = makeMessage({ content: '<@123456789012345678> qual a capital do brasil?' });
    const api = fakeApiService(async () => {
      throw new Error('network down');
    });
    await handleTagResponse(message, api);
    expect(message.replies.length).toBe(1);
  });

  it('sends only non-bot recent messages to the backend, oldest first', async () => {
    let sentRecentMessages: unknown;
    const message = makeMessage({
      content: '<@123456789012345678> o que vocês acham disso?',
      recentMessages: [
        { author: { username: 'marquinhos', bot: true }, content: 'beep boop' },
        { author: { username: 'ana' }, content: 'mais recente' },
        { author: { username: 'joao' }, content: 'mais antiga' },
      ],
    });
    const api = fakeApiService(async (payload) => {
      sentRecentMessages = payload.recentMessages;
      return { data: { status: 'ok', category: 'opinion_reference', reply: 'ok' } };
    });
    await handleTagResponse(message, api);
    expect(sentRecentMessages).toEqual([
      { author: 'joao', content: 'mais antiga' },
      { author: 'ana', content: 'mais recente' },
    ]);
  });
});
