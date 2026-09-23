import {
  askInThread,
  startResearch,
} from '@marquinhos/contracts/http/routes/aiChat';
import { describe, expect, it } from 'bun:test';

const acceptsAsk = (body: unknown) => askInThread.body.safeParse(body).success;
const acceptsResearch = (body: unknown) =>
  startResearch.body.safeParse(body).success;

const validAsk = {
  threadId: 't1',
  guildId: 'g1',
  channelId: 'c1',
  userId: 'u1',
  content: 'quanto é 2+2?',
};

describe('askInThread body', () => {
  it('accepts a valid payload', () => {
    expect(acceptsAsk(validAsk)).toBe(true);
  });

  it('accepts an explicit mode', () => {
    expect(acceptsAsk({ ...validAsk, mode: 'research' })).toBe(true);
  });

  it('rejects an unknown mode', () => {
    expect(acceptsAsk({ ...validAsk, mode: 'freestyle' })).toBe(false);
  });

  it.each(['threadId', 'guildId', 'channelId', 'userId', 'content'])(
    'rejects a payload missing %s',
    (field) => {
      const body: Record<string, unknown> = { ...validAsk };
      delete body[field];
      expect(acceptsAsk(body)).toBe(false);
    },
  );

  it('rejects empty content', () => {
    expect(acceptsAsk({ ...validAsk, content: '' })).toBe(false);
  });

  it('rejects content past the cap so one message cannot blow the context', () => {
    expect(acceptsAsk({ ...validAsk, content: 'a'.repeat(4001) })).toBe(false);
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

describe('startResearch body', () => {
  it('accepts a valid payload', () => {
    expect(acceptsResearch(validResearch)).toBe(true);
  });

  it('requires the idempotency key, since the bot retries on 5xx', () => {
    const body: Record<string, unknown> = { ...validResearch };
    delete body.idempotencyKey;
    expect(acceptsResearch(body)).toBe(false);
  });

  it('rejects a query too short to research', () => {
    expect(acceptsResearch({ ...validResearch, query: 'x' })).toBe(false);
  });

  it('rejects a query past the cap', () => {
    expect(acceptsResearch({ ...validResearch, query: 'a'.repeat(1001) })).toBe(
      false,
    );
  });

  it.each(['threadId', 'guildId', 'channelId', 'userId'])(
    'rejects a payload missing %s',
    (field) => {
      const body: Record<string, unknown> = { ...validResearch };
      delete body[field];
      expect(acceptsResearch(body)).toBe(false);
    },
  );
});
