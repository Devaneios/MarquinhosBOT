import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('services/activity/roomKey');
const { getValidationSet } = await import('../../src/services/wordle');
const wordle = await import('@marquinhos/contracts/activity/games/wordle');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await bootColyseusTestServer((server) => {
    server.define('match', MatchRoom).filterBy(['roomKey']);
  });
});
afterEach(async () => {
  await colyseus.cleanup();
});
afterAll(async () => {
  await colyseus.shutdown();
});

describe('wordle protocol', () => {
  it('saves realtime draft updates with optimistic revisions and no correctness signal', async () => {
    const identity = {
      userId: 'draft-user',
      instanceId: 'draft-inst',
      guildId: `guild-${randomUUID()}`,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const client = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const init = await nextMessage<{ wordLength: number; date: string }>(
      client,
      'init',
    );
    const payload = {
      date: init.date,
      rowIndex: 0,
      cells: Array(init.wordLength).fill(''),
      activeIndex: 2,
      expectedRevision: 0,
      requestId: 1,
    };

    client.send('draft_update', payload);
    const saved = await nextMessage<{
      status: string;
      requestId: number;
      draft: {
        date: string;
        rowIndex: number;
        cells: string[];
        activeIndex: number;
        revision: number;
      };
    }>(client, 'draft_result');
    expect(saved).toEqual({
      status: 'saved',
      requestId: 1,
      draft: {
        date: init.date,
        rowIndex: 0,
        cells: payload.cells,
        activeIndex: 2,
        revision: 1,
      },
    });
    expect(saved).not.toHaveProperty('correct');

    client.send('draft_update', {
      ...payload,
      cells: Array(init.wordLength).fill('a'),
      requestId: 2,
    });
    const conflict = await nextMessage<{
      status: string;
      requestId: number;
      draft: { revision: number };
    }>(client, 'draft_result');
    expect(conflict).toEqual({
      status: 'conflict',
      draft: saved.draft,
      requestId: 2,
    });
    expect(unparsedMessages([client], wordle.serverMessageSchema)).toEqual([]);
  });

  it('sends only messages the wordle protocol describes', async () => {
    const identity = {
      userId: 'user-a',
      instanceId: 'inst-1',
      guildId: `guild-${randomUUID()}`,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const client = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const init = await nextMessage<{ wordLength: number }>(client, 'init');
    const guess =
      [...getValidationSet()].find((word) => word.length === init.wordLength) ??
      '';

    client.send('guess', { guess: 'x' });
    await nextMessage(client, 'guess_error');
    client.send('guess', { guess });
    await nextMessage(client, 'guess_result');

    expect(unparsedMessages([client], wordle.serverMessageSchema)).toEqual([]);
  });
});
