import {
  buildThreadName,
  runThreadTurn,
  sendThreadReply,
  type AiThreadChannel,
  type ThreadSendPayload,
} from '@marquinhos/services/aiChat/aiThread';
import type { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { describe, expect, it } from 'bun:test';
import type { EmbedBuilder } from 'discord.js';

interface FakeThread extends AiThreadChannel {
  sent: ThreadSendPayload[];
  typingCount: number;
}

function makeThread(overrides: Partial<AiThreadChannel> = {}): FakeThread {
  const sent: ThreadSendPayload[] = [];
  const thread = {
    id: 'thread-1',
    guildId: 'guild-1',
    parentId: 'channel-1',
    typingCount: 0,
    sent,
    async sendTyping() {
      thread.typingCount++;
      return undefined;
    },
    async send(payload: ThreadSendPayload) {
      sent.push(payload);
      return undefined;
    },
    client: { user: { displayAvatarURL: () => 'https://avatar' } },
    ...overrides,
  } as FakeThread;
  return thread;
}

function makeApi(
  data: Record<string, unknown>,
): Pick<MarquinhosApiService, 'askInThread'> {
  return {
    askInThread: async () => ({ data }),
  } as unknown as Pick<MarquinhosApiService, 'askInThread'>;
}

function embedOf(payload: ThreadSendPayload) {
  return (payload as { embeds: EmbedBuilder[] }).embeds[0]!.toJSON();
}

describe('buildThreadName', () => {
  it('prefixes a short question verbatim', () => {
    expect(buildThreadName('💭', 'quanto é 2+2?')).toBe('💭 quanto é 2+2?');
  });

  it('collapses whitespace', () => {
    expect(buildThreadName('💭', '  quanto   é\n2+2? ')).toBe(
      '💭 quanto é 2+2?',
    );
  });

  it('truncates a long question on a word boundary and marks the cut', () => {
    const name = buildThreadName('🔬', 'palavra '.repeat(40));

    expect(name.length).toBeLessThanOrEqual(100);
    expect(name.endsWith('…')).toBe(true);
    expect(name).not.toContain('palavr…');
  });

  it('stays inside the Discord thread-name limit for a single long word', () => {
    expect(buildThreadName('🔬', 'a'.repeat(300)).length).toBeLessThanOrEqual(
      100,
    );
  });
});

describe('sendThreadReply', () => {
  it('sends a short text reply as one plain message', async () => {
    const thread = makeThread();

    await sendThreadReply(thread, 'a resposta é 4.', { format: 'text' });

    expect(thread.sent).toEqual(['a resposta é 4.']);
  });

  it('sends an embed when the format asks for one', async () => {
    const thread = makeThread();

    await sendThreadReply(thread, 'conteudo longo', {
      format: 'embed',
      embedTitle: '💻 Técnico',
    });

    expect(embedOf(thread.sent[0]!)).toMatchObject({
      title: '💻 Técnico',
      description: 'conteudo longo',
    });
  });

  it('uses a default embed title when none is given', async () => {
    const thread = makeThread();

    await sendThreadReply(thread, 'x', { format: 'embed' });

    expect(embedOf(thread.sent[0]!).title).toBeTruthy();
  });

  it('splits a reply too long for one Discord message', async () => {
    const thread = makeThread();
    const long = Array.from({ length: 200 }, (_, i) => `linha ${i}`).join('\n');

    await sendThreadReply(thread, long.repeat(3), { format: 'text' });

    expect(thread.sent.length).toBeGreaterThan(1);
    for (const chunk of thread.sent) {
      expect(String(chunk).length).toBeLessThanOrEqual(2000);
    }
  });

  it('falls back to splitting when an embed reply exceeds the embed limit', async () => {
    const thread = makeThread();

    await sendThreadReply(thread, 'a'.repeat(5000), { format: 'embed' });

    expect(thread.sent.length).toBeGreaterThan(1);
    expect(typeof thread.sent[0]).toBe('string');
  });
});

describe('runThreadTurn', () => {
  const okData = { status: 'ok', reply: 'a resposta é 4.', format: 'text' };

  it('sends the thread payload to the API and posts the reply', async () => {
    const thread = makeThread();
    let payload: Record<string, unknown> | undefined;
    const api = {
      askInThread: async (body: Record<string, unknown>) => {
        payload = body;
        return { data: okData };
      },
    } as unknown as Pick<MarquinhosApiService, 'askInThread'>;

    await runThreadTurn(thread, 'user-1', 'quanto é 2+2?', api);

    expect(payload).toEqual({
      threadId: 'thread-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      userId: 'user-1',
      content: 'quanto é 2+2?',
    });
    expect(thread.sent).toEqual(['a resposta é 4.']);
  });

  it('falls back to the thread id when the thread has no parent', async () => {
    const thread = makeThread({ parentId: null });
    let payload: Record<string, unknown> | undefined;
    const api = {
      askInThread: async (body: Record<string, unknown>) => {
        payload = body;
        return { data: okData };
      },
    } as unknown as Pick<MarquinhosApiService, 'askInThread'>;

    await runThreadTurn(thread, 'user-1', 'oi', api);

    expect(payload?.channelId).toBe('thread-1');
  });

  it('triggers typing so the user sees the bot working', async () => {
    const thread = makeThread();

    await runThreadTurn(thread, 'user-1', 'oi', makeApi(okData));

    expect(thread.typingCount).toBeGreaterThanOrEqual(1);
  });

  it('keeps re-triggering typing while the API is slow', async () => {
    const thread = makeThread();
    const api = {
      askInThread: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { data: okData };
      },
    } as unknown as Pick<MarquinhosApiService, 'askInThread'>;

    await runThreadTurn(thread, 'user-1', 'oi', api, 10);

    expect(thread.typingCount).toBeGreaterThan(1);
  });

  it('posts the rate limit message when the API says so', async () => {
    const thread = makeThread();

    await runThreadTurn(
      thread,
      'user-1',
      'oi',
      makeApi({ status: 'rate_limited' }),
    );

    expect(String(thread.sent[0])).toContain('cansado');
  });

  it('posts a fallback when the API returns an error status', async () => {
    const thread = makeThread();

    await runThreadTurn(thread, 'user-1', 'oi', makeApi({ status: 'error' }));

    expect(thread.sent).toHaveLength(1);
    expect(String(thread.sent[0]).length).toBeGreaterThan(0);
  });

  it('posts a fallback when the API returns ok but no reply', async () => {
    const thread = makeThread();

    await runThreadTurn(thread, 'user-1', 'oi', makeApi({ status: 'ok' }));

    expect(thread.sent).toHaveLength(1);
  });

  it('posts a fallback instead of throwing when the API call blows up', async () => {
    const thread = makeThread();
    const api = {
      askInThread: async () => {
        throw new Error('network down');
      },
    } as unknown as Pick<MarquinhosApiService, 'askInThread'>;

    await runThreadTurn(thread, 'user-1', 'oi', api);

    expect(thread.sent).toHaveLength(1);
    expect(String(thread.sent[0])).not.toContain('network down');
  });

  it('does nothing outside a guild', async () => {
    const thread = makeThread({ guildId: null });
    let called = false;
    const api = {
      askInThread: async () => {
        called = true;
        return { data: okData };
      },
    } as unknown as Pick<MarquinhosApiService, 'askInThread'>;

    await runThreadTurn(thread, 'user-1', 'oi', api);

    expect(called).toBe(false);
    expect(thread.sent).toEqual([]);
  });
});
