import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';

// Set in-memory db BEFORE any imports that load the db module — mirrors
// tests/wordle.spec.ts so this suite doesn't touch the real marquinhos.db.
process.env.SQLITE_PATH = ':memory:';

const { MatchRoom } = await import('../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage } =
  await import('./helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../src/services/activity/wsSessionToken');
const { roomKey } = await import('@marquinhos/domain/activity/roomKey');
const { getValidationSet } = await import('../src/services/wordle');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;

let colyseus: ColyseusTestServer;
const testRunId = randomUUID();

beforeAll(async () => {
  colyseus = await bootColyseusTestServer((server) => {
    server.define('match', MatchRoom).filterBy(['roomKey']);
  });
});

afterEach(async () => {
  if (colyseus) await colyseus.cleanup();
});

afterAll(async () => {
  if (colyseus) await colyseus.shutdown();
});

function sessionFor(userId: string, guildId: string) {
  const instanceId = 'inst-1';
  const game = 'wordle' as const;
  const mode = 'single' as const;
  const key = roomKey({ instanceId, game, mode, userId });
  const token = mintWsSessionToken({
    userId,
    instanceId,
    guildId: `${guildId}-${testRunId}`,
    mode,
    game,
  });
  return { token, roomKey: key };
}

function pickWordOfLength(length: number): string {
  for (const w of getValidationSet()) {
    if (w.length === length) return w;
  }
  throw new Error(`no validation word of length ${length} found`);
}

describe('MatchRoom · wordle', () => {
  it('rejects a join with an invalid session token', async () => {
    const room = await colyseus.createRoom('match', {
      game: 'wordle',
      roomKey: 'inst-1:wordle:single:user-a',
    });

    await expect(
      colyseus.connectTo(room, {
        token: 'garbage',
        roomKey: 'inst-1:wordle:single:user-a',
      }),
    ).rejects.toBeTruthy();
  });

  it('rejects a join whose roomKey does not match the token identity', async () => {
    const session = sessionFor('user-a', 'guild-1');
    const room = await colyseus.createRoom('match', {
      game: 'wordle',
      roomKey: session.roomKey,
    });

    await expect(
      colyseus.connectTo(room, {
        token: session.token,
        roomKey: 'inst-1:wordle:single:someone-else',
      }),
    ).rejects.toBeTruthy();
  });

  it('sends an init payload with word length and empty guess history on join', async () => {
    const session = sessionFor('user-a', 'guild-init');
    const room = await colyseus.createRoom('match', {
      game: 'wordle',
      roomKey: session.roomKey,
    });
    const client = await colyseus.connectTo(room, session);

    const init = await nextMessage<{
      wordLength: number;
      guesses: unknown[];
      solved: boolean;
      attempts: number;
    }>(client, 'init');

    expect(init.wordLength).toBeGreaterThanOrEqual(5);
    expect(init.guesses).toEqual([]);
    expect(init.solved).toBe(false);
    expect(init.attempts).toBe(0);
  });

  it('replies guess_result for a valid guess of the right length', async () => {
    const session = sessionFor('user-a', 'guild-validguess');
    const room = await colyseus.createRoom('match', {
      game: 'wordle',
      roomKey: session.roomKey,
    });
    const client = await colyseus.connectTo(room, session);
    const init = await nextMessage<{
      wordLength: number;
      guesses: unknown[];
      solved: boolean;
      attempts: number;
    }>(client, 'init');
    const guess = pickWordOfLength(init.wordLength);

    client.send('guess', { guess });
    const [type, payload] = await client.waitForNextMessage();

    expect(type).toBe('guess_result');
    expect(payload.feedback.length).toBe(init.wordLength);
    expect(payload.attempts).toBe(1);
  });

  it('replies guess_error for a guess of the wrong length', async () => {
    const session = sessionFor('user-a', 'guild-wronglen');
    const room = await colyseus.createRoom('match', {
      game: 'wordle',
      roomKey: session.roomKey,
    });
    const client = await colyseus.connectTo(room, session);
    const init = await nextMessage<{
      wordLength: number;
      guesses: unknown[];
      solved: boolean;
      attempts: number;
    }>(client, 'init');

    client.send('guess', { guess: 'a'.repeat(init.wordLength + 2) });
    const [type, payload] = await client.waitForNextMessage();

    expect(type).toBe('guess_error');
    expect(typeof payload.message).toBe('string');
  });

  it('rate-limits rapid guesses from the same connection', async () => {
    const session = sessionFor('user-a', 'guild-ratelimit');
    const room = await colyseus.createRoom('match', {
      game: 'wordle',
      roomKey: session.roomKey,
    });
    const client = await colyseus.connectTo(room, session);
    const init = await nextMessage<{
      wordLength: number;
      guesses: unknown[];
      solved: boolean;
      attempts: number;
    }>(client, 'init');
    const badGuess = 'a'.repeat(init.wordLength + 2);

    let replies = 0;
    client.onMessage('guess_error', () => {
      replies += 1;
    });

    for (let i = 0; i < 50; i++) {
      client.send('guess', { guess: badGuess });
    }
    await client.waitForNextMessage(200);

    expect(replies).toBeGreaterThan(0);
    expect(replies).toBeLessThan(50);
  });
});
