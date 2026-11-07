import { db } from '@marquinhos/database/client';
import { wordleCommunityDailyPresence } from '@marquinhos/database/schema';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  spyOn,
} from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getRecifeDate } from '../src/modules/wordle/services/wordle-date';
import { testRoomDependencies } from './helpers/realtimeTestDependencies';

const { createMatchRoom } = await import('../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, pendingMessages } =
  await import('./helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../src/modules/activity/ws-session-token');
const { roomKey } = await import('modules/activity/room-key');
const { WordleService } = await import('../src/modules/wordle/wordle.service');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;

let colyseus: ColyseusTestServer;
const testRunId = randomUUID();

beforeAll(async () => {
  colyseus = await bootColyseusTestServer((server) => {
    server
      .define('match', createMatchRoom(testRoomDependencies))
      .filterBy(['roomKey']);
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
    guildMembershipVerified: true,
    mode,
    game,
  });
  return { token, roomKey: key };
}

function pickWordOfLength(length: number): string {
  for (const w of testRoomDependencies.wordBank.getValidationSet()) {
    if (w.length === length) return w;
  }
  throw new Error(`no validation word of length ${length} found`);
}

describe('MatchRoom · wordle', () => {
  it('rejects a private token for another game without verified membership', async () => {
    const identity = {
      userId: 'unverified-user',
      instanceId: 'inst-1',
      guildId: 'other-guild',
      mode: 'single',
      game: 'pong',
    } as const;
    const room = await colyseus.createRoom('match', {
      game: 'wordle',
      roomKey: roomKey({ ...identity, game: 'wordle' }),
    });
    await expect(
      colyseus.connectTo(room, {
        token: mintWsSessionToken(identity),
        roomKey: roomKey(identity),
      }),
    ).rejects.toThrow('Guild membership');
  });

  it('rejects switching an unverified private room into Wordle', async () => {
    const identity = {
      userId: 'unverified-host',
      instanceId: 'inst-1',
      guildId: 'other-guild',
      mode: 'single',
      game: 'pong',
    } as const;
    const token = mintWsSessionToken(identity);
    const options = { token, roomKey: roomKey(identity) };
    const room = await colyseus.createRoom('match', options);
    const client = await colyseus.connectTo(room, options);
    client.send('switch_game', { game: 'wordle' });
    expect(
      await nextMessage<{ error: string }>(client, 'action_rejected'),
    ).toEqual({
      error: 'Guild membership is required for Wordle',
    });
  });

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
    const presence = await db
      .select()
      .from(wordleCommunityDailyPresence)
      .where(
        and(
          eq(wordleCommunityDailyPresence.user_id, 'user-a'),
          eq(wordleCommunityDailyPresence.guild_id, `guild-init-${testRunId}`),
          eq(wordleCommunityDailyPresence.word_date, getRecifeDate()),
        ),
      );
    expect(presence).toHaveLength(1);
  });

  it('still sends init when presence cannot be recorded', async () => {
    const presence = spyOn(
      WordleService.prototype,
      'recordParticipation',
    ).mockRejectedValue(new Error('database unavailable'));
    try {
      const session = sessionFor('user-presence-down', 'guild-presence-down');
      const room = await colyseus.createRoom('match', {
        game: 'wordle',
        roomKey: session.roomKey,
      });
      const client = await colyseus.connectTo(room, session);
      const init = await nextMessage<{ attempts: number }>(client, 'init');
      expect(init.attempts).toBe(0);
      expect(presence).toHaveBeenCalled();
    } finally {
      presence.mockRestore();
    }
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
    const payload = await nextMessage<{
      feedback: unknown[];
      attempts: number;
    }>(client, 'guess_result');

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
    const payload = await nextMessage<{ message: unknown }>(
      client,
      'guess_error',
    );

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

    for (let i = 0; i < 50; i++) {
      client.send('guess', { guess: badGuess });
    }
    await nextMessage(client, 'guess_error');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const replies = 1 + pendingMessages(client, 'guess_error').length;

    expect(replies).toBeLessThan(50);
  });
});
