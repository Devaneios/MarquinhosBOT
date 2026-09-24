import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('services/activity/roomKey');
const trivia = await import('@marquinhos/contracts/activity/games/triviaQuiz');

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

function creds(userId: string) {
  const identity = {
    userId,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode: 'multi',
    game: 'trivia-quiz',
    roomId: 'TRIVIA',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('trivia-quiz protocol', () => {
  it('sends only messages the trivia protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'trivia-quiz',
    });
    const clientA = await colyseus.connectTo(room, a);
    await nextMessage(clientA, 'init');
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientB, 'init');
    const question = await nextMessage(clientA, 'state_update');

    clientA.send('answer', { answerIndex: 0 });
    await nextMessage(
      clientB,
      'state_update',
      (payload) =>
        (payload as { playerScores: unknown[] }).playerScores.length === 2,
    );

    const clientC = await colyseus.connectTo(room, creds('user-c'));
    await nextMessage(clientC, 'init');
    const lateQuestion = await nextMessage(clientC, 'state_update');
    expect(lateQuestion).toMatchObject({
      currentQuestionIndex: (question as { currentQuestionIndex: number })
        .currentQuestionIndex,
    });

    expect(
      unparsedMessages([clientA, clientB, clientC], trivia.serverMessageSchema),
    ).toEqual([]);
  });
});
