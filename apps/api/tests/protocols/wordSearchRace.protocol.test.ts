import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('@marquinhos/domain/activity/roomKey');
const wordSearchRace =
  await import('@marquinhos/contracts/activity/games/wordSearchRace');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;
type Cell = { row: number; col: number };
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

function creds(userId: string) {
  const identity = {
    userId,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode: 'multi',
    game: 'word-search-race',
    roomId: 'WORDSEARCH',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

function locate(grid: string[][], word: string): { start: Cell; end: Cell } {
  const steps = [-1, 0, 1].flatMap((dr) =>
    [-1, 0, 1].map((dc) => [dr, dc] as const),
  );
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid.length; col++) {
      for (const [dr, dc] of steps) {
        if (dr === 0 && dc === 0) continue;
        const spelled = [...word].every(
          (letter, i) => grid[row + dr * i]?.[col + dc * i] === letter,
        );
        if (spelled) {
          const last = word.length - 1;
          return {
            start: { row, col },
            end: { row: row + dr * last, col: col + dc * last },
          };
        }
      }
    }
  }
  throw new Error(`${word} is not on the grid`);
}

describe('word-search-race protocol', () => {
  it('sends only messages the word-search-race protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'word-search-race',
    });
    const clientA = await colyseus.connectTo(room, a);
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    const init = await nextMessage<{ grid: string[][]; words: string[] }>(
      clientA,
      'init',
    );
    await nextMessage(clientB, 'init');

    clientA.send('select', { start: { row: 'x' }, end: { row: 0, col: 0 } });
    await nextMessage(clientA, 'select_error');
    clientA.send('select', locate(init.grid, init.words[0]!));
    await nextMessage(clientB, 'word_found');

    expect(
      unparsedMessages([clientA, clientB], wordSearchRace.serverMessageSchema),
    ).toEqual([]);
  });
});
