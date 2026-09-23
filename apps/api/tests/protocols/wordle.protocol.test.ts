import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('@marquinhos/domain/activity/roomKey');
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
