import { describe, expect, it, mock } from 'bun:test';
import { EmojiReactionService } from 'services/aiChat/EmojiReactionService';
import type { OpenAiClient } from 'services/aiChat/OpenAiClient';

function fakeOpenAiClient(result: unknown | Error): OpenAiClient {
  return {
    structured: mock(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  } as unknown as OpenAiClient;
}

describe('EmojiReactionService.chooseReactions', () => {
  it('resolves known standard and custom emoji names to reactable format', async () => {
    const client = fakeOpenAiClient({
      emojis: ['grinning', 'cavaloemoji'],
    });
    const service = new EmojiReactionService(client);

    const result = await service.chooseReactions({ content: 'kkkkk' });

    expect(result).toEqual(['😀', 'cavaloemoji:725868757779742787']);
  });

  it('drops hallucinated names not present in either catalog', async () => {
    const client = fakeOpenAiClient({
      emojis: ['grinning', 'totally_made_up_emoji'],
    });
    const service = new EmojiReactionService(client);

    const result = await service.chooseReactions({ content: 'kkkkk' });

    expect(result).toEqual(['😀']);
  });

  it('falls back to a default reactable when every name is hallucinated', async () => {
    const client = fakeOpenAiClient({ emojis: ['totally_made_up_emoji'] });
    const service = new EmojiReactionService(client);

    const result = await service.chooseReactions({ content: 'kkkkk' });

    expect(result).toEqual(['👍']);
  });

  it('falls back to a default reactable when the LLM call throws', async () => {
    const client = fakeOpenAiClient(new Error('openai down'));
    const service = new EmojiReactionService(client);

    const result = await service.chooseReactions({ content: 'kkkkk' });

    expect(result).toEqual(['👍']);
  });

  it('includes recentMessages as chat history in the user prompt', async () => {
    const structured = mock(async () => ({ emojis: ['grinning'] }));
    const client = { structured } as unknown as OpenAiClient;
    const service = new EmojiReactionService(client);

    await service.chooseReactions({
      content: 'kkkkk',
      recentMessages: [{ author: 'ana', content: 'oi' }],
    });

    const call = structured.mock.calls[0] as unknown[];
    const messages = call[0] as { role: string; content: string }[];
    const userMessage = messages.find((m) => m.role === 'user');
    expect(userMessage?.content).toContain('<chat_history>');
    expect(userMessage?.content).toContain('ana: oi');
    expect(userMessage?.content).toContain('<message>\nkkkkk\n</message>');
  });
});
