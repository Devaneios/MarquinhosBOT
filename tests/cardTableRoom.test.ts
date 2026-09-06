import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { Server } = await import('colyseus');
const { WebSocketTransport } = await import('@colyseus/ws-transport');
const { boot } = await import('@colyseus/testing');
const { CardTableRoom } = await import('../src/realtime/CardTableRoom');
const { mintWsSessionToken } =
  await import('../src/services/activity/wsSessionToken');
const { roomKey } = await import('../src/services/activity/roomKey');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;
type TestClient = Awaited<ReturnType<ColyseusTestServer['connectTo']>>;

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  const gameServer = new Server({ transport: new WebSocketTransport() });
  gameServer.define('cards', CardTableRoom).filterBy(['roomKey']);
  colyseus = await boot(gameServer);
});

afterEach(async () => {
  await colyseus.cleanup();
});

afterAll(async () => {
  await colyseus.shutdown();
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sessionFor(userId: string) {
  const instanceId = 'inst-1';
  const game = 'cards' as const;
  const ruleset = 'truco';
  const key = roomKey({ instanceId, game, mode: 'multi', userId, ruleset });
  const token = mintWsSessionToken({
    userId,
    instanceId,
    guildId: 'guild-1',
    mode: 'multi',
    game,
    ruleset,
  });
  return { token, roomKey: key };
}

// Joins all 4 seats, registering a persistent 'state'/'init' listener on
// each client BEFORE the next one joins — waitForNextMessage() only
// resolves for messages that arrive after it's called, so collecting the
// table-filling broadcast (which fires the instant the 4th seat joins)
// requires listeners already attached, not a sequence of one-shot awaits.
async function seatFourPlayers(): Promise<{
  clients: TestClient[];
  inits: Record<string, unknown>[];
  states: Record<string, unknown>[];
  room: Awaited<ReturnType<typeof colyseus.createRoom>>;
}> {
  const clients: TestClient[] = [];
  const inits: Record<string, unknown>[] = [];
  const states: Record<string, unknown>[] = [];
  let room: Awaited<ReturnType<typeof colyseus.createRoom>> | undefined;

  for (const userId of ['user-a', 'user-b', 'user-c', 'user-d']) {
    const session = sessionFor(userId);
    if (!room) {
      room = await colyseus.createRoom('cards', {
        roomKey: session.roomKey,
        token: session.token,
      });
    }
    const client = await colyseus.connectTo(room!, session);
    const index = clients.length;
    client.onMessage('init', (payload: Record<string, unknown>) => {
      inits[index] = payload;
    });
    client.onMessage('state', (payload: Record<string, unknown>) => {
      states[index] = payload;
    });
    clients.push(client);
  }
  await wait(30);
  return { clients, inits, states, room: room! };
}

describe('CardTableRoom', () => {
  it('rejects a join with an invalid session token', async () => {
    const session = sessionFor('user-a');
    const room = await colyseus.createRoom('cards', {
      roomKey: session.roomKey,
      token: session.token,
    });

    expect(
      colyseus.connectTo(room, { token: 'garbage', roomKey: session.roomKey }),
    ).rejects.toBeTruthy();
  });

  it('starts the match and sends every player a state view once all 4 seats fill', async () => {
    const { states } = await seatFourPlayers();

    expect(states).toHaveLength(4);
    for (const payload of states) {
      expect(payload.matchScore).toEqual({ A: 0, B: 0 });
    }
  });

  it("masks each player's view so only their own hand contents are visible", async () => {
    const { states } = await seatFourPlayers();

    type MaskedHand = {
      count: number;
      cards: { hidden?: true; id?: string }[];
    };
    const hands = states[0]!.hands as Record<number, MaskedHand>;

    expect(hands[0]!.count).toBe(3);
    expect(hands[0]!.cards.every((c) => typeof c.id === 'string')).toBe(true);

    // Everyone else: three cards' worth of positions, no card identities.
    expect(hands[1]!.count).toBe(3);
    expect(hands[1]!.cards.every((c) => c.hidden === true)).toBe(true);
  });

  it('never sends one player any part of another hand, over the wire', async () => {
    const { states } = await seatFourPlayers();

    // The end-to-end version of the masking guarantee: whatever seat 1 was
    // dealt must not appear anywhere in the payload seat 0 received.
    const seat1Cards = (
      states[1]!.hands as Record<number, { cards: { id?: string }[] }>
    )[1]!.cards.map((c) => c.id);
    const seat0Payload = JSON.stringify(states[0]);

    expect(seat1Cards.filter(Boolean)).toHaveLength(3);
    for (const cardId of seat1Cards) {
      expect(seat0Payload).not.toContain(cardId!);
    }
  });

  it('delivers state to every socket a single user holds', async () => {
    // Two tabs, or a React remount mid-reconnect, is two clients for one
    // userId. Resolving just the first one leaves the other tab dead.
    const session = sessionFor('user-a');
    const room = await colyseus.createRoom('cards', {
      roomKey: session.roomKey,
      token: session.token,
    });

    const tabA = await colyseus.connectTo(room, session);
    const tabB = await colyseus.connectTo(room, session);
    const seen: Record<string, unknown>[] = [];
    tabA.onMessage('state', (p: Record<string, unknown>) => {
      seen[0] = p;
    });
    tabB.onMessage('state', (p: Record<string, unknown>) => {
      seen[1] = p;
    });

    // Fill the remaining seats so a state broadcast happens.
    for (const userId of ['user-b', 'user-c', 'user-d']) {
      await colyseus.connectTo(room, sessionFor(userId));
    }
    await wait(30);

    expect(seen[0]).toBeDefined();
    expect(seen[1]).toBeDefined();
  });

  it('admits a fifth viewer as a spectator with no cards revealed', async () => {
    const { room } = await seatFourPlayers();

    const watcher = await colyseus.connectTo(room, sessionFor('user-e'));
    let init: { seatIndex: number | null } | undefined;
    let state: Record<string, unknown> | undefined;
    watcher.onMessage('init', (p: { seatIndex: number | null }) => {
      init = p;
    });
    watcher.onMessage('state', (p: Record<string, unknown>) => {
      state = p;
    });
    await wait(30);

    expect(init?.seatIndex).toBeNull();
    const hands = state!.hands as Record<
      number,
      { cards: { hidden?: true }[] }
    >;
    for (const seatIndex of [0, 1, 2, 3]) {
      expect(hands[seatIndex]!.cards.every((c) => c.hidden === true)).toBe(
        true,
      );
    }
  });

  it('rejects a move played out of turn without affecting other players', async () => {
    const { clients } = await seatFourPlayers();

    let rejection: Record<string, unknown> | undefined;
    clients[1]!.onMessage(
      'move_rejected',
      (payload: Record<string, unknown>) => {
        rejection = payload;
      },
    );

    // seat 1 (user-b) is not seat 0 — the hand's first turn — so this move
    // must be rejected.
    clients[1]!.send('move', { move: 'play_card', args: { cardId: 'bogus' } });
    await wait(30);

    expect(rejection?.reason).toBeTruthy();
  });
});
