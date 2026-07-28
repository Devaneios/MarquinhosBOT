import {
  handleAiThreadMessage,
  isAiThread,
  type AiThreadMessage,
} from '@marquinhos/services/aiChat/aiThreadMessage';
import type { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { describe, expect, it } from 'bun:test';

const BOT_ID = 'bot-1';

function makeMessage(overrides: {
  content?: string;
  authorBot?: boolean;
  authorId?: string;
  guildId?: string | null;
  threadName?: string;
  ownerId?: string | null;
  isThread?: boolean;
  noClientUser?: boolean;
}): AiThreadMessage & { sent: unknown[] } {
  const sent: unknown[] = [];
  return {
    content: overrides.content ?? 'e por que isso?',
    author: {
      id: overrides.authorId ?? 'user-1',
      bot: overrides.authorBot ?? false,
    },
    guildId: overrides.guildId === undefined ? 'guild-1' : overrides.guildId,
    client: {
      user: overrides.noClientUser
        ? null
        : { id: BOT_ID, displayAvatarURL: () => 'https://avatar' },
    },
    sent,
    channel: {
      id: 'thread-1',
      guildId: 'guild-1',
      parentId: 'channel-1',
      name: overrides.threadName ?? '💭 quanto é 2+2?',
      ownerId: overrides.ownerId === undefined ? BOT_ID : overrides.ownerId,
      isThread: () => overrides.isThread ?? true,
      async sendTyping() {
        return undefined;
      },
      async send(payload: unknown) {
        sent.push(payload);
        return undefined;
      },
      client: { user: { displayAvatarURL: () => 'https://avatar' } },
    },
  } as unknown as AiThreadMessage & { sent: unknown[] };
}

function makeApi(reply = 'porque sim.') {
  const calls: Record<string, unknown>[] = [];
  const api = {
    askInThread: async (body: Record<string, unknown>) => {
      calls.push(body);
      return { data: { status: 'ok', reply, format: 'text' } };
    },
  } as unknown as Pick<MarquinhosApiService, 'askInThread'>;
  return { api, calls };
}

describe('isAiThread', () => {
  it('recognises an ask thread the bot owns', () => {
    expect(
      isAiThread(
        { isThread: () => true, name: '💭 pergunta', ownerId: BOT_ID },
        BOT_ID,
      ),
    ).toBe(true);
  });

  it('recognises a research thread the bot owns', () => {
    expect(
      isAiThread(
        { isThread: () => true, name: '🔬 tema', ownerId: BOT_ID },
        BOT_ID,
      ),
    ).toBe(true);
  });

  it('rejects a normal channel', () => {
    expect(
      isAiThread(
        { isThread: () => false, name: '💭 pergunta', ownerId: BOT_ID },
        BOT_ID,
      ),
    ).toBe(false);
  });

  it('rejects a thread someone else created', () => {
    expect(
      isAiThread(
        { isThread: () => true, name: '💭 pergunta', ownerId: 'user-9' },
        BOT_ID,
      ),
    ).toBe(false);
  });

  it('rejects a bot thread that is not an AI thread', () => {
    expect(
      isAiThread(
        { isThread: () => true, name: '🎮 partida de termo', ownerId: BOT_ID },
        BOT_ID,
      ),
    ).toBe(false);
  });

  it('rejects a thread with no name', () => {
    expect(isAiThread({ isThread: () => true, ownerId: BOT_ID }, BOT_ID)).toBe(
      false,
    );
  });
});

describe('handleAiThreadMessage', () => {
  it('handles a follow-up in an AI thread with no tag needed', async () => {
    const message = makeMessage({ content: 'e por que isso?' });
    const { api, calls } = makeApi();

    const handled = await handleAiThreadMessage(message, api);

    expect(handled).toBe(true);
    expect(calls[0]).toMatchObject({
      threadId: 'thread-1',
      userId: 'user-1',
      content: 'e por que isso?',
    });
    expect(message.sent).toEqual(['porque sim.']);
  });

  it('trims the content before sending it', async () => {
    const message = makeMessage({ content: '   e por que?  ' });
    const { api, calls } = makeApi();

    await handleAiThreadMessage(message, api);

    expect(calls[0]?.content).toBe('e por que?');
  });

  it('ignores a message outside a thread so the tag flow still gets it', async () => {
    const message = makeMessage({ isThread: false });
    const { api, calls } = makeApi();

    expect(await handleAiThreadMessage(message, api)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('ignores a thread the bot did not open', async () => {
    const message = makeMessage({ ownerId: 'user-9' });
    const { api, calls } = makeApi();

    expect(await handleAiThreadMessage(message, api)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('ignores messages from bots, so it cannot answer itself', async () => {
    const message = makeMessage({ authorBot: true });
    const { api, calls } = makeApi();

    expect(await handleAiThreadMessage(message, api)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('ignores a message outside a guild', async () => {
    const message = makeMessage({ guildId: null });
    const { api, calls } = makeApi();

    expect(await handleAiThreadMessage(message, api)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('ignores an empty message, such as an attachment with no text', async () => {
    const message = makeMessage({ content: '   ' });
    const { api, calls } = makeApi();

    expect(await handleAiThreadMessage(message, api)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('gates an over-long follow-up without calling the API', async () => {
    const message = makeMessage({ content: 'a'.repeat(4001) });
    const { api, calls } = makeApi();

    expect(await handleAiThreadMessage(message, api)).toBe(true);
    expect(calls).toEqual([]);
    expect(String(message.sent[0])).toContain('Resume');
  });

  it('does nothing before the client is ready', async () => {
    const message = makeMessage({ noClientUser: true });
    const { api, calls } = makeApi();

    expect(await handleAiThreadMessage(message, api)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('answers a follow-up in a research thread too', async () => {
    const message = makeMessage({
      threadName: '🔬 estado da arte de X',
      content: 'resume a fonte 2',
    });
    const { api, calls } = makeApi('a fonte 2 diz que...');

    expect(await handleAiThreadMessage(message, api)).toBe(true);
    expect(calls[0]?.content).toBe('resume a fonte 2');
  });
});
