import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { Client } from 'discord.js';
import {
  _resetErrorHandlingForTests,
  flushPendingErrors,
  reportError,
  safeExecute,
  setDiscordClient,
} from '../src/utils/errorHandling';
import {
  _resetErrorHistoryForTests,
  getRecentErrors,
} from '../src/utils/errorHistory';

describe('safeExecute', () => {
  it('returns a function', () => {
    const wrapped = safeExecute(() => {});
    expect(typeof wrapped).toBe('function');
  });

  it('does not rethrow when the wrapped function throws synchronously', () => {
    const wrapped = safeExecute(() => {
      throw new Error('sync boom');
    });
    expect(() => wrapped()).not.toThrow();
  });

  it('does not throw when the wrapped function resolves normally', () => {
    const wrapped = safeExecute(() => Promise.resolve(42));
    expect(() => wrapped()).not.toThrow();
  });

  it('does not throw synchronously when the wrapped function returns a rejected promise', () => {
    const wrapped = safeExecute(() => Promise.reject(new Error('async boom')));
    expect(() => wrapped()).not.toThrow();
  });

  it('the returned wrapper is invoked with no arguments', () => {
    let callArgs: unknown[] | undefined;
    const wrapped = safeExecute((...args: unknown[]) => {
      callArgs = args;
    });
    wrapped();
    expect(callArgs).toEqual([]);
  });
});

function fakeClient(sendImpl: () => Promise<unknown>) {
  const send = mock(sendImpl);
  const fetchUser = mock(async () => ({ send }));
  const client = { users: { fetch: fetchUser } } as unknown as Client;
  return { client, fetchUser, send };
}

describe('reportError', () => {
  beforeEach(() => {
    _resetErrorHistoryForTests();
    _resetErrorHandlingForTests();
  });

  afterEach(() => {
    _resetErrorHandlingForTests();
  });

  it('records the error into error history', () => {
    reportError(new Error('boom'), { origin: 'test-origin', logLevel: 'warn' });

    const recent = getRecentErrors();
    expect(recent).toHaveLength(1);
    expect(recent[0]?.origin).toBe('test-origin');
    expect(recent[0]?.logLevel).toBe('warn');
    expect(recent[0]?.message).toBe('boom');
  });

  it('defaults to error level when none is given', () => {
    reportError(new Error('boom'), { origin: 'test-origin' });
    expect(getRecentErrors()[0]?.logLevel).toBe('error');
  });

  it('does not throw when no Discord client has been set yet', async () => {
    reportError(new Error('boom'), { origin: 'test-origin' });
    await expect(flushPendingErrors()).resolves.toBeUndefined();
  });

  it('sends a queued batch via DM once flushed', async () => {
    const { client, fetchUser, send } = fakeClient(async () => undefined);
    setDiscordClient(client);

    reportError(new Error('boom'), {
      origin: 'test-origin',
      logLevel: 'error',
    });
    await flushPendingErrors();

    expect(fetchUser).toHaveBeenCalledWith('test-dm-user-id');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('keeps the batch queued for retry when the DM send fails', async () => {
    const { client, send } = fakeClient(async () => {
      throw new Error('DMs closed');
    });
    setDiscordClient(client);

    reportError(new Error('boom'), {
      origin: 'test-origin',
      logLevel: 'error',
    });
    await flushPendingErrors();
    await flushPendingErrors();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('clears the queue once a retry succeeds', async () => {
    let shouldFail = true;
    const { client, send } = fakeClient(async () => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('DMs closed');
      }
      return undefined;
    });
    setDiscordClient(client);

    reportError(new Error('boom'), {
      origin: 'test-origin',
      logLevel: 'error',
    });
    await flushPendingErrors();
    await flushPendingErrors();
    await flushPendingErrors();

    expect(send).toHaveBeenCalledTimes(2);
  });

  // Discord rejects a message with more than 10 embeds or 6000 characters
  // across them, and a rejected batch would be retried forever.
  function sentEmbeds(send: ReturnType<typeof fakeClient>['send']) {
    const [message] = send.mock.calls.at(-1) as unknown as [
      {
        embeds: {
          title: string;
          description: string;
          fields: { name: string; value: string }[];
        }[];
      },
    ];
    return message.embeds;
  }

  function embedChars(embeds: ReturnType<typeof sentEmbeds>): number {
    return embeds.reduce(
      (total, embed) =>
        total +
        embed.title.length +
        embed.description.length +
        embed.fields.reduce(
          (sum, f) => sum + f.name.length + f.value.length,
          0,
        ),
      0,
    );
  }

  it('sends at most 10 embeds and summarizes the rest', async () => {
    const { client, send } = fakeClient(async () => undefined);
    setDiscordClient(client);

    for (let i = 0; i < 15; i++) {
      reportError(new Error(`boom ${i}`), { origin: 'test-origin' });
    }
    await flushPendingErrors();

    const embeds = sentEmbeds(send);
    expect(embeds.length).toBeLessThanOrEqual(10);
    expect(embeds.at(-1)?.title).toContain('more');
  });

  it('keeps a batch of long errors within 6000 characters', async () => {
    const { client, send } = fakeClient(async () => undefined);
    setDiscordClient(client);

    for (let i = 0; i < 10; i++) {
      const error = new Error('x'.repeat(300));
      error.stack = 'y'.repeat(2000);
      reportError(error, { origin: 'test-origin' });
    }
    await flushPendingErrors();

    expect(embedChars(sentEmbeds(send))).toBeLessThanOrEqual(6000);
  });

  it('keeps errors reported while a batch is being sent', async () => {
    const { client, send } = fakeClient(async () => {
      if (send.mock.calls.length === 1) {
        reportError(new Error('during send'), { origin: 'test-origin' });
      }
      return undefined;
    });
    setDiscordClient(client);

    reportError(new Error('first'), { origin: 'test-origin' });
    await flushPendingErrors();
    await flushPendingErrors();

    expect(send).toHaveBeenCalledTimes(2);
    expect(sentEmbeds(send)[0]?.title).toBe('during send');
  });

  it('keeps only the newest 100 errors while DMs cannot be delivered', async () => {
    for (let i = 0; i < 150; i++) {
      reportError(new Error(`boom ${i}`), { origin: 'test-origin' });
    }
    const { client, send } = fakeClient(async () => undefined);
    setDiscordClient(client);
    await flushPendingErrors();

    const embeds = sentEmbeds(send);
    expect(embeds[0]?.title).toBe('boom 50');
    expect(embeds.at(-1)?.title).toBe(
      `... and ${100 - (embeds.length - 1)} more errors`,
    );
  });
});
