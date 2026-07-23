import { describe, expect, it } from 'bun:test';
import { GuildConfig } from '@marquinhos/config/guild';
import { handleTagResponse } from '@marquinhos/services/aiChat/tagResponse';
import type { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import type { EmbedBuilder } from 'discord.js';

function makeMessage(
  overrides: Partial<{
    content: string;
    guildId: string | null;
    channelId: string;
    mentionsBot: boolean;
    recentMessages: {
      id: string;
      author: { id: string; username: string; bot?: boolean };
      content: string;
    }[];
  }> = {},
) {
  const replies: string[] = [];
  const sends: string[] = [];
  const embedReplies: EmbedBuilder[] = [];
  const typingCalls: number[] = [];
  return {
    id: 'trigger-message',
    content: overrides.content ?? '<@bot1> oi',
    author: { id: 'user1' },
    guildId: overrides.guildId ?? GuildConfig.DEVANEIOS_GUILD_ID,
    channelId: overrides.channelId ?? GuildConfig.DEVANEIOS_CHANNEL_ID,
    client: {
      user: { id: 'bot1', displayAvatarURL: () => 'https://example.com/avatar.png' },
    },
    mentions: { has: () => overrides.mentionsBot ?? true },
    channel: {
      sendTyping: async () => {
        typingCalls.push(1);
      },
      send: async (payload: string | { embeds: EmbedBuilder[] }) => {
        if (typeof payload === 'string') {
          sends.push(payload);
        } else {
          embedReplies.push(...payload.embeds);
        }
      },
      messages: {
        fetch: async () =>
          new Map((overrides.recentMessages ?? []).map((m) => [m.id, m])),
      },
    },
    reply: async (payload: string | { embeds: EmbedBuilder[] }) => {
      if (typeof payload === 'string') {
        replies.push(payload);
      } else {
        embedReplies.push(...payload.embeds);
      }
    },
    replies,
    sends,
    embedReplies,
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
    const longContent = '<@bot1> ' + 'a'.repeat(2100);
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

  it('sends recent messages oldest first, keeping its own messages labeled and dropping other bots and the triggering message', async () => {
    let sentRecentMessages: unknown;
    const message = makeMessage({
      content: '<@bot1> o que vocês acham disso?',
      recentMessages: [
        {
          id: 'trigger-message',
          author: { id: 'user1', username: 'fazendeiro' },
          content: '<@bot1> o que vocês acham disso?',
        },
        {
          id: 'm3',
          author: { id: 'bot1', username: 'marquinhos', bot: true },
          content: 'beep boop',
        },
        {
          id: 'm2',
          author: { id: 'other-bot', username: 'mee6', bot: true },
          content: 'spam de bot',
        },
        {
          id: 'm1',
          author: { id: 'user2', username: 'ana' },
          content: 'mais antiga',
        },
      ],
    });
    const api = fakeApiService(async (payload) => {
      sentRecentMessages = payload.recentMessages;
      return { data: { status: 'ok', category: 'opinion_reference', reply: 'ok' } };
    });
    await handleTagResponse(message, api);
    expect(sentRecentMessages).toEqual([
      { author: 'ana', content: 'mais antiga' },
      { author: 'você (bot)', content: 'beep boop' },
    ]);
  });

  it('strips the bot mention from the content sent to the backend', async () => {
    let sentContent: unknown;
    const message = makeMessage({
      content: '<@bot1> qual a capital do brasil?',
    });
    const api = fakeApiService(async (payload) => {
      sentContent = payload.content;
      return { data: { status: 'ok', category: 'general_question', reply: 'Brasília.' } };
    });
    await handleTagResponse(message, api);
    expect(sentContent).toBe('qual a capital do brasil?');
  });

  it('splits replies longer than 2000 characters across multiple messages', async () => {
    const longReply = ('linha de resposta longa\n'.repeat(200)).trim();
    const message = makeMessage({ content: '<@bot1> me explica tudo' });
    const api = fakeApiService(async () => ({
      data: { status: 'ok', category: 'general_question', reply: longReply },
    }));
    await handleTagResponse(message, api);
    expect(message.replies.length).toBe(1);
    expect(message.sends.length).toBeGreaterThan(0);
    for (const chunk of [...message.replies, ...message.sends]) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
    expect(
      [...message.replies, ...message.sends].join('\n'),
    ).toBe(longReply);
  });

  it('replies with an embed when the backend reports format "embed"', async () => {
    const message = makeMessage({ content: '<@bot1> como resolvo esse erro?' });
    const api = fakeApiService(async () => ({
      data: {
        status: 'ok',
        category: 'code_technical_question',
        reply: 'Tenta capturar a exceção com try/catch.',
        format: 'embed',
        embedTitle: '💻 Resposta técnica',
      },
    }));
    await handleTagResponse(message, api);
    expect(message.replies.length).toBe(0);
    expect(message.embedReplies.length).toBe(1);
    expect(message.embedReplies[0]?.data.title).toBe('💻 Resposta técnica');
    expect(message.embedReplies[0]?.data.description).toBe(
      'Tenta capturar a exceção com try/catch.',
    );
  });

  it('falls back to plain text when an "embed" reply exceeds the embed description limit', async () => {
    const longReply = 'x'.repeat(4100);
    const message = makeMessage({ content: '<@bot1> me explica tudo' });
    const api = fakeApiService(async () => ({
      data: {
        status: 'ok',
        category: 'general_question',
        reply: longReply,
        format: 'embed',
        embedTitle: '💭 Resposta',
      },
    }));
    await handleTagResponse(message, api);
    expect(message.embedReplies.length).toBe(0);
    expect(message.replies.length).toBe(1);
    expect(message.sends.length).toBeGreaterThan(0);
  });
});
