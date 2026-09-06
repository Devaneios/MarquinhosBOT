import { describe, expect, it } from 'bun:test';
import {
  aiResearchStartSchema,
  aiThreadAskSchema,
} from 'schemas/aiChat.schema';

function wrap(body: Record<string, unknown>) {
  return { body, query: {}, params: {} };
}

const validAsk = {
  threadId: 't1',
  guildId: 'g1',
  channelId: 'c1',
  userId: 'u1',
  content: 'quanto é 2+2?',
};

describe('aiThreadAskSchema', () => {
  it('accepts a valid payload', async () => {
    expect(aiThreadAskSchema.parseAsync(wrap(validAsk))).resolves.toBeDefined();
  });

  it('accepts an explicit mode', async () => {
    expect(
      aiThreadAskSchema.parseAsync(wrap({ ...validAsk, mode: 'research' })),
    ).resolves.toBeDefined();
  });

  it('rejects an unknown mode', async () => {
    expect(
      aiThreadAskSchema.parseAsync(wrap({ ...validAsk, mode: 'freestyle' })),
    ).rejects.toThrow();
  });

  it.each(['threadId', 'guildId', 'channelId', 'userId', 'content'])(
    'rejects a payload missing %s',
    async (field) => {
      const body: Record<string, unknown> = { ...validAsk };
      delete body[field];
      expect(aiThreadAskSchema.parseAsync(wrap(body))).rejects.toThrow();
    },
  );

  it('rejects empty content', async () => {
    expect(
      aiThreadAskSchema.parseAsync(wrap({ ...validAsk, content: '' })),
    ).rejects.toThrow();
  });

  it('rejects content past the cap so one message cannot blow the context', async () => {
    expect(
      aiThreadAskSchema.parseAsync(
        wrap({ ...validAsk, content: 'a'.repeat(4001) }),
      ),
    ).rejects.toThrow();
  });
});

const validResearch = {
  threadId: 't1',
  guildId: 'g1',
  channelId: 'c1',
  userId: 'u1',
  query: 'estado da arte de X',
  idempotencyKey: 'interaction-1',
};

describe('aiResearchStartSchema', () => {
  it('accepts a valid payload', async () => {
    expect(
      aiResearchStartSchema.parseAsync(wrap(validResearch)),
    ).resolves.toBeDefined();
  });

  it('requires the idempotency key, since the bot retries on 5xx', async () => {
    const body: Record<string, unknown> = { ...validResearch };
    delete body.idempotencyKey;
    expect(aiResearchStartSchema.parseAsync(wrap(body))).rejects.toThrow();
  });

  it('rejects a query too short to research', async () => {
    expect(
      aiResearchStartSchema.parseAsync(wrap({ ...validResearch, query: 'x' })),
    ).rejects.toThrow();
  });

  it('rejects a query past the cap', async () => {
    expect(
      aiResearchStartSchema.parseAsync(
        wrap({ ...validResearch, query: 'a'.repeat(1001) }),
      ),
    ).rejects.toThrow();
  });

  it.each(['threadId', 'guildId', 'channelId', 'userId'])(
    'rejects a payload missing %s',
    async (field) => {
      const body: Record<string, unknown> = { ...validResearch };
      delete body[field];
      expect(aiResearchStartSchema.parseAsync(wrap(body))).rejects.toThrow();
    },
  );
});
