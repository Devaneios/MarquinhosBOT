import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { Server } = await import('colyseus');
const { WebSocketTransport } = await import('@colyseus/ws-transport');
const { boot } = await import('@colyseus/testing');
const { MatchRoom } = await import('../src/realtime/MatchRoom');
const { mintWsSessionToken } =
  await import('../src/services/activity/wsSessionToken');
const { roomKey } = await import('../src/services/activity/roomKey');
const { ACTION_REJECTED } =
  await import('../src/services/activity/shared/ActionResult');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;

let colyseus: ColyseusTestServer;

function ticTacToeCreds(userId: string, roomId: string) {
  const key = roomKey({
    instanceId: 'inst-1',
    game: 'tic-tac-toe',
    mode: 'multi',
    userId,
    roomId,
  });
  const token = mintWsSessionToken({
    userId,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode: 'multi',
    game: 'tic-tac-toe',
    roomId,
  });
  return { key, token };
}

// Plays out the exact move sequence used throughout this file: X (user-a)
// completes the top row on move 5, with O (user-b) losing.
async function playXWinsTopRow(
  room: Awaited<ReturnType<ColyseusTestServer['createRoom']>>,
  clientA: Awaited<ReturnType<ColyseusTestServer['connectTo']>>,
  clientB: Awaited<ReturnType<ColyseusTestServer['connectTo']>>,
) {
  clientA.send('move', { row: 0, col: 0 });
  await room.waitForNextPatch();
  clientB.send('move', { row: 1, col: 0 });
  await room.waitForNextPatch();
  clientA.send('move', { row: 0, col: 1 });
  await room.waitForNextPatch();
  clientB.send('move', { row: 1, col: 1 });
  await room.waitForNextPatch();
  clientA.send('move', { row: 0, col: 2 }); // X completes the top row
  await room.waitForNextPatch();
}

// Shared setup: two players play out a match to a decisive win with the
// queue OFF (so nothing auto-rotates), then the host turns the queue on and
// a third client joins it — leaving a stable, concluded match with a seated
// winner+loser and one queued challenger, ready for a deliberate manual
// `rotate_seat` or an explicit `'leave'` in a test.
async function concludedMatchWithQueue(roomId: string) {
  const { key } = ticTacToeCreds('user-a', roomId);
  const room = await colyseus.createRoom('match', {
    roomKey: key,
    game: 'tic-tac-toe',
    queueEnabled: false,
  });
  const clientA = await colyseus.connectTo(room, {
    token: ticTacToeCreds('user-a', roomId).token,
    roomKey: key,
  });
  const clientB = await colyseus.connectTo(room, {
    token: ticTacToeCreds('user-b', roomId).token,
    roomKey: key,
  });

  await playXWinsTopRow(room, clientA, clientB);

  clientA.send('toggle_queue', { enabled: true });
  await room.waitForNextPatch();

  return { room, key, clientA, clientB };
}

beforeAll(async () => {
  const gameServer = new Server({ transport: new WebSocketTransport() });
  gameServer.define('match', MatchRoom).filterBy(['roomKey']);
  colyseus = await boot(gameServer);
});

afterEach(async () => {
  await colyseus.cleanup();
});

afterAll(async () => {
  await colyseus.shutdown();
});

describe('MatchRoom', () => {
  it('seats the first joiner as host and player for a Hangman room', async () => {
    const key = roomKey({
      instanceId: 'inst-1',
      game: 'hangman',
      mode: 'multi',
      userId: 'user-a',
      roomId: 'ROOM01',
    });
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'hangman',
    });
    const token = mintWsSessionToken({
      userId: 'user-a',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'hangman',
      roomId: 'ROOM01',
    });

    const client = await colyseus.connectTo(room, { token, roomKey: key });
    expect(client).toBeTruthy();
  });

  it('rejects a join with an invalid session token', async () => {
    const key = 'inst-1:ROOM01:hangman:multi';
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'hangman',
    });

    await expect(
      colyseus.connectTo(room, { token: 'garbage', roomKey: key }),
    ).rejects.toBeTruthy();
  });

  it('routes a guess message through the Hangman adapter and returns a response', async () => {
    const key = roomKey({
      instanceId: 'inst-1',
      game: 'hangman',
      mode: 'multi',
      userId: 'user-a',
      roomId: 'ROOM02',
    });
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'hangman',
    });
    const token = mintWsSessionToken({
      userId: 'user-a',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'hangman',
      roomId: 'ROOM02',
    });
    const client = await colyseus.connectTo(room, { token, roomKey: key });
    await client.waitForNextMessage(); // init

    // HangmanSession.guessLetter() first broadcasts `game_state` to the
    // whole room, then the adapter sends `guess_success` directly to the
    // guesser — so listen for the specific type rather than "next message".
    const success = new Promise<void>((resolve) => {
      client.onMessage('guess_success', () => resolve());
    });
    client.send('guess', { letter: 'a' });

    // 'a' is always a fresh, valid letter for a brand-new session, so the
    // adapter's guessLetter() call is guaranteed to succeed regardless of
    // which word getHangmanWord() picked.
    await success;
  });

  it('rate-limits rapid guess messages, dropping the one that crosses the window limit', async () => {
    const key = roomKey({
      instanceId: 'inst-1',
      game: 'hangman',
      mode: 'multi',
      userId: 'user-a',
      roomId: 'ROOM03',
    });
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'hangman',
    });
    const token = mintWsSessionToken({
      userId: 'user-a',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'hangman',
      roomId: 'ROOM03',
    });
    const client = await colyseus.connectTo(room, { token, roomKey: key });
    await client.waitForNextMessage(); // init

    let replies = 0;
    client.onMessage('guess_success', () => {
      replies += 1;
    });
    client.onMessage('guess_error', () => {
      replies += 1;
    });

    // The Hangman adapter's guess rate limit is 3 per 1000ms; each letter is
    // distinct and unguessed so every processed guess would otherwise
    // succeed, isolating the rate limiter as the only thing that can drop
    // the 4th one.
    for (const letter of ['a', 'e', 'i', 'o']) {
      client.send('guess', { letter });
    }
    await client.waitForNextMessage(200);

    expect(replies).toBe(3);
  });

  it('throws when creating a room for a game with no registered adapter', async () => {
    await expect(
      colyseus.createRoom('match', {
        roomKey: 'inst-1:ROOM04:not-a-real-game:multi',
        game: 'not-a-real-game',
      }),
    ).rejects.toBeTruthy();
  });

  it('does not leak game_ready broadcasts across two concurrent Tic-Tac-Toe rooms', async () => {
    // ADAPTER_REGISTRY holds one shared adapter object per game across every
    // concurrent room of that game. Regression test for a bug where the
    // Tic-Tac-Toe adapter captured its AdapterContext in a module-level
    // variable inside setup() — the second room's setup() call clobbered the
    // first room's captured context, so a game_ready broadcast triggered by
    // filling room A's second seat would fire through room B's ctx.broadcast
    // into room B's connections instead. Room A is created first but filled
    // second, which is the exact ordering that would trigger the bug: room
    // B's setup() (called when B is created, after A) overwrites the
    // module-level capture before A's second player ever joins.
    function ticTacToeSession(userId: string, roomId: string) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'tic-tac-toe',
        mode: 'multi',
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'tic-tac-toe',
        roomId,
      });
      return { key, token };
    }

    const a1 = ticTacToeSession('a-user-1', 'ROOMA');
    const roomA = await colyseus.createRoom('match', {
      roomKey: a1.key,
      game: 'tic-tac-toe',
    });
    const clientA1 = await colyseus.connectTo(roomA, {
      token: a1.token,
      roomKey: a1.key,
    });
    await clientA1.waitForNextMessage(); // init

    const b1 = ticTacToeSession('b-user-1', 'ROOMB');
    const roomB = await colyseus.createRoom('match', {
      roomKey: b1.key,
      game: 'tic-tac-toe',
    });
    const clientB1 = await colyseus.connectTo(roomB, {
      token: b1.token,
      roomKey: b1.key,
    });
    await clientB1.waitForNextMessage(); // init

    const b2 = ticTacToeSession('b-user-2', 'ROOMB');
    const clientB2 = await colyseus.connectTo(roomB, {
      token: b2.token,
      roomKey: b2.key,
    });
    await clientB2.waitForNextMessage(); // init

    let aGotGameReady = false;
    let bGotGameReady = false;
    clientA1.onMessage('game_ready', () => {
      aGotGameReady = true;
    });
    clientB1.onMessage('game_ready', () => {
      bGotGameReady = true;
    });

    const a2 = ticTacToeSession('a-user-2', 'ROOMA');
    const clientA2 = await colyseus.connectTo(roomA, {
      token: a2.token,
      roomKey: a2.key,
    });
    await clientA2.waitForNextMessage(); // init

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(aGotGameReady).toBe(true);
    expect(bGotGameReady).toBe(false);
  });

  it('rotates the loser to the back of the queue and promotes the queue head', async () => {
    const key = roomKey({
      instanceId: 'inst-1',
      game: 'tic-tac-toe',
      mode: 'multi',
      userId: 'user-a',
      roomId: 'ROOM02',
    });
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'tic-tac-toe',
      queueEnabled: true,
    });

    const tokenFor = (userId: string) =>
      mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'tic-tac-toe',
        roomId: 'ROOM02',
      });

    const clientA = await colyseus.connectTo(room, {
      token: tokenFor('user-a'),
      roomKey: key,
    });
    const clientB = await colyseus.connectTo(room, {
      token: tokenFor('user-b'),
      roomKey: key,
    });
    const clientC = await colyseus.connectTo(room, {
      token: tokenFor('user-c'),
      roomKey: key,
    });

    // user-a is X, user-b is O, user-c queues. X wins top row; O (user-b)
    // should rotate to the back of the queue and user-c should be promoted.
    clientA.send('move', { row: 0, col: 0 });
    await room.waitForNextPatch();
    clientB.send('move', { row: 1, col: 0 });
    await room.waitForNextPatch();
    clientA.send('move', { row: 0, col: 1 });
    await room.waitForNextPatch();
    clientB.send('move', { row: 1, col: 1 });
    await room.waitForNextPatch();
    clientA.send('move', { row: 0, col: 2 });
    await room.waitForNextPatch();

    // Room-level "match ended, queue rotated" happens synchronously inside
    // the room's message handler, driven off the same session state the
    // move above already flushed — no further tick to wait for.
    const roomInternals = room as unknown as {
      members: Array<{ userId: string; role: string }>;
    };
    const b = roomInternals.members.find((m) => m.userId === 'user-b');
    const c = roomInternals.members.find((m) => m.userId === 'user-c');
    expect(b?.role).toBe('queued');
    expect(c?.role).toBe('player');

    clientA.leave();
    clientB.leave();
    clientC.leave();
  });

  it('does not cascade a rotation onto the next broadcast once a match has already rotated', async () => {
    // Regression test for the bug where `maybeRotateAfterMatchEnd()` had no
    // "already rotated" guard: the engine's winner stays set until both
    // remaining players vote restart, so the very next broadcast (here, a
    // partial restart vote) would recompute "loser" as the just-promoted
    // challenger and rotate them straight back out.
    const key = roomKey({
      instanceId: 'inst-1',
      game: 'tic-tac-toe',
      mode: 'multi',
      userId: 'user-a',
      roomId: 'ROOM20',
    });
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'tic-tac-toe',
      queueEnabled: true,
    });

    const clientA = await colyseus.connectTo(room, {
      token: ticTacToeCreds('user-a', 'ROOM20').token,
      roomKey: key,
    });
    const clientB = await colyseus.connectTo(room, {
      token: ticTacToeCreds('user-b', 'ROOM20').token,
      roomKey: key,
    });
    const clientC = await colyseus.connectTo(room, {
      token: ticTacToeCreds('user-c', 'ROOM20').token,
      roomKey: key,
    });
    const clientD = await colyseus.connectTo(room, {
      token: ticTacToeCreds('user-d', 'ROOM20').token,
      roomKey: key,
    });

    await playXWinsTopRow(room, clientA, clientB);

    const roomInternals = room as unknown as {
      members: Array<{ userId: string; role: string }>;
    };
    // First rotation: user-b (loser) -> queued, user-c (queue head) -> player.
    expect(roomInternals.members.find((m) => m.userId === 'user-b')?.role).toBe(
      'queued',
    );
    expect(roomInternals.members.find((m) => m.userId === 'user-c')?.role).toBe(
      'player',
    );
    expect(roomInternals.members.find((m) => m.userId === 'user-d')?.role).toBe(
      'queued',
    );

    // A partial restart vote still broadcasts `restart_status` (only 1 of the
    // 2 required votes is in), which re-invokes the ctx.broadcast rotation
    // hook against the same still-set winner. Without the dedup guard this
    // would incorrectly rotate user-c back out and promote user-d.
    clientA.send('restart', {});
    await room.waitForNextPatch();

    expect(roomInternals.members.find((m) => m.userId === 'user-c')?.role).toBe(
      'player',
    );
    expect(roomInternals.members.find((m) => m.userId === 'user-d')?.role).toBe(
      'queued',
    );
    expect(roomInternals.members.find((m) => m.userId === 'user-b')?.role).toBe(
      'queued',
    );

    clientA.leave();
    clientB.leave();
    clientC.leave();
    clientD.leave();
  });

  it('seats a player into a bingo-speed room and returns their card on init', async () => {
    const key = roomKey({
      instanceId: 'inst-1',
      game: 'bingo-speed',
      mode: 'multi',
      userId: 'user-a',
      roomId: 'ROOM03',
    });
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'bingo-speed',
    });
    const token = mintWsSessionToken({
      userId: 'user-a',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'bingo-speed',
      roomId: 'ROOM03',
    });
    const messages: unknown[] = [];
    const client = await colyseus.connectTo(room, { token, roomKey: key });
    client.onMessage('init', (msg) => messages.push(msg));
    await room.waitForNextPatch();
    expect(messages.length).toBeGreaterThan(0);
  });

  it('seats a player into a boggle-word-race room and returns the grid on init', async () => {
    const key = roomKey({
      instanceId: 'inst-1',
      game: 'boggle-word-race',
      mode: 'multi',
      userId: 'user-a',
      roomId: 'ROOM04',
    });
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'boggle-word-race',
    });
    const token = mintWsSessionToken({
      userId: 'user-a',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'boggle-word-race',
      roomId: 'ROOM04',
    });
    const messages: unknown[] = [];
    const client = await colyseus.connectTo(room, { token, roomKey: key });
    client.onMessage('init', (msg) => messages.push(msg));
    await room.waitForNextPatch();
    expect(messages.length).toBeGreaterThan(0);
    expect((messages[0] as { grid: unknown }).grid).toBeTruthy();
  });

  describe('switch_game', () => {
    it('rejects a non-host request', async () => {
      const { key } = ticTacToeCreds('user-a', 'ROOM30');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'tic-tac-toe',
      });
      const clientA = await colyseus.connectTo(room, {
        token: ticTacToeCreds('user-a', 'ROOM30').token,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: ticTacToeCreds('user-b', 'ROOM30').token,
        roomKey: key,
      });

      const rejection = new Promise<{ error: string }>((resolve) => {
        clientB.onMessage(ACTION_REJECTED, (payload: { error: string }) =>
          resolve(payload),
        );
      });
      clientB.send('switch_game', { game: 'hangman' });
      const payload = await rejection;
      expect(payload.error).toMatch(/host/i);

      clientA.leave();
      clientB.leave();
    });

    it('rejects a switch while a match is in progress', async () => {
      const { key } = ticTacToeCreds('user-a', 'ROOM31');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'tic-tac-toe',
      });
      const clientA = await colyseus.connectTo(room, {
        token: ticTacToeCreds('user-a', 'ROOM31').token,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: ticTacToeCreds('user-b', 'ROOM31').token,
        roomKey: key,
      });

      // Both seats are full and there's no winner yet — a match is in progress.
      const rejection = new Promise<{ error: string }>((resolve) => {
        clientA.onMessage(ACTION_REJECTED, (payload: { error: string }) =>
          resolve(payload),
        );
      });
      clientA.send('switch_game', { game: 'hangman' });
      const payload = await rejection;
      expect(payload.error).toMatch(/mid-match/i);

      clientA.leave();
      clientB.leave();
    });

    it("rejects 'cards' as a switch target", async () => {
      const { key, token } = ticTacToeCreds('user-a', 'ROOM32');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'tic-tac-toe',
      });
      const clientA = await colyseus.connectTo(room, { token, roomKey: key });

      const rejection = new Promise<{ error: string }>((resolve) => {
        clientA.onMessage(ACTION_REJECTED, (payload: { error: string }) =>
          resolve(payload),
        );
      });
      clientA.send('switch_game', { game: 'cards' });
      const payload = await rejection;
      expect(payload.error).toMatch(/unknown or unswitchable/i);

      clientA.leave();
    });

    it('rejects an unregistered game id', async () => {
      const { key, token } = ticTacToeCreds('user-a', 'ROOM33');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'tic-tac-toe',
      });
      const clientA = await colyseus.connectTo(room, { token, roomKey: key });

      const rejection = new Promise<{ error: string }>((resolve) => {
        clientA.onMessage(ACTION_REJECTED, (payload: { error: string }) =>
          resolve(payload),
        );
      });
      clientA.send('switch_game', { game: 'not-a-real-game' });
      const payload = await rejection;
      expect(payload.error).toMatch(/unknown or unswitchable/i);

      clientA.leave();
    });
  });

  describe('toggle_queue', () => {
    it('flips queueEnabled and updates room metadata when the host toggles it', async () => {
      const { key, token } = ticTacToeCreds('user-a', 'ROOM34');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'tic-tac-toe',
      });
      const clientA = await colyseus.connectTo(room, { token, roomKey: key });

      clientA.send('toggle_queue', { enabled: true });
      await room.waitForNextPatch();

      expect(
        (room as unknown as { metadata: { queueEnabled: boolean } }).metadata
          .queueEnabled,
      ).toBe(true);

      clientA.leave();
    });

    it('rejects a non-host request and leaves queueEnabled unchanged', async () => {
      const { key, token: tokenA } = ticTacToeCreds('user-a', 'ROOM35');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'tic-tac-toe',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: ticTacToeCreds('user-b', 'ROOM35').token,
        roomKey: key,
      });

      const rejection = new Promise<{ error: string }>((resolve) => {
        clientB.onMessage(ACTION_REJECTED, (payload: { error: string }) =>
          resolve(payload),
        );
      });
      clientB.send('toggle_queue', { enabled: true });
      const payload = await rejection;
      expect(payload.error).toMatch(/host/i);
      expect(
        (room as unknown as { metadata: { queueEnabled: boolean } }).metadata
          .queueEnabled,
      ).toBe(false);

      clientA.leave();
      clientB.leave();
    });
  });

  describe('rotate_seat', () => {
    it('rejects a request from someone who is not a seated player', async () => {
      const { room, key, clientA, clientB } =
        await concludedMatchWithQueue('ROOM36');
      const clientC = await colyseus.connectTo(room, {
        token: ticTacToeCreds('user-c', 'ROOM36').token,
        roomKey: key,
      });

      const rejection = new Promise<{ error: string }>((resolve) => {
        clientC.onMessage(ACTION_REJECTED, (payload: { error: string }) =>
          resolve(payload),
        );
      });
      clientC.send('rotate_seat');
      const payload = await rejection;
      expect(payload.error).toMatch(/seated player/i);

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });

    it('rejects a request when the queue is empty', async () => {
      const { clientA, clientB } = await concludedMatchWithQueue('ROOM37');

      const rejection = new Promise<{ error: string }>((resolve) => {
        clientA.onMessage(ACTION_REJECTED, (payload: { error: string }) =>
          resolve(payload),
        );
      });
      clientA.send('rotate_seat');
      const payload = await rejection;
      expect(payload.error).toMatch(/no one is waiting/i);

      clientA.leave();
      clientB.leave();
    });

    it('succeeds and promotes the queue head when a seated player rotates out', async () => {
      const { room, key, clientA, clientB } =
        await concludedMatchWithQueue('ROOM38');
      const clientC = await colyseus.connectTo(room, {
        token: ticTacToeCreds('user-c', 'ROOM38').token,
        roomKey: key,
      });

      clientB.send('rotate_seat');
      await room.waitForNextPatch();

      const roomInternals = room as unknown as {
        members: Array<{ userId: string; role: string }>;
      };
      expect(
        roomInternals.members.find((m) => m.userId === 'user-b')?.role,
      ).toBe('queued');
      expect(
        roomInternals.members.find((m) => m.userId === 'user-c')?.role,
      ).toBe('player');

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });

    it('does not get reversed by a later broadcast for the same match', async () => {
      // Regression test: a manual rotate_seat must also arm the
      // rotatedForCurrentMatch guard, or the very next broadcast for this
      // still-unrestarted match (here, a partial restart vote) would find
      // the guard untouched, see the same winner still set, and
      // auto-rotate the just-promoted player straight back out.
      const { room, key, clientA, clientB } =
        await concludedMatchWithQueue('ROOM39');
      const clientC = await colyseus.connectTo(room, {
        token: ticTacToeCreds('user-c', 'ROOM39').token,
        roomKey: key,
      });
      const clientD = await colyseus.connectTo(room, {
        token: ticTacToeCreds('user-d', 'ROOM39').token,
        roomKey: key,
      });

      clientB.send('rotate_seat');
      await room.waitForNextPatch();

      const roomInternals = room as unknown as {
        members: Array<{ userId: string; role: string }>;
      };
      expect(
        roomInternals.members.find((m) => m.userId === 'user-c')?.role,
      ).toBe('player');
      expect(
        roomInternals.members.find((m) => m.userId === 'user-d')?.role,
      ).toBe('queued');

      // The winner's restart vote is only 1 of the 2 now required — it
      // still broadcasts `restart_status`, re-invoking the deferred
      // rotation hook against the same still-set winner.
      clientA.send('restart', {});
      await room.waitForNextPatch();

      expect(
        roomInternals.members.find((m) => m.userId === 'user-c')?.role,
      ).toBe('player');
      expect(
        roomInternals.members.find((m) => m.userId === 'user-d')?.role,
      ).toBe('queued');
      expect(
        roomInternals.members.find((m) => m.userId === 'user-b')?.role,
      ).toBe('queued');

      clientA.leave();
      clientB.leave();
      clientC.leave();
      clientD.leave();
    });
  });

  describe("'leave' message after a match concludes", () => {
    it("promotes the queue head into the departing player's vacated seat", async () => {
      // TicTacToeSession.leave() -> detach() unconditionally removes the
      // departing player from the session (forfeit-then-remove), even when
      // the match had already concluded — so the queue hand-off has to be
      // attempted BEFORE the adapter's own 'leave' handler runs, while the
      // departing player's marker is still present for substitutePlayer()
      // to find. This exercises that ordering: the match is already over
      // (user-a won) before user-b, the loser, explicitly leaves.
      const { room, key, clientA, clientB } =
        await concludedMatchWithQueue('ROOM40');
      const clientC = await colyseus.connectTo(room, {
        token: ticTacToeCreds('user-c', 'ROOM40').token,
        roomKey: key,
      });

      // user-b (the loser) sends the application-level 'leave' message
      // rather than closing the socket.
      clientB.send('leave');
      await room.waitForNextPatch();

      const roomInternals = room as unknown as {
        members: Array<{ userId: string; role: string }>;
      };
      expect(
        roomInternals.members.find((m) => m.userId === 'user-b'),
      ).toBeUndefined();
      expect(
        roomInternals.members.find((m) => m.userId === 'user-c')?.role,
      ).toBe('player');

      clientA.leave();
      clientC.leave();
    });
  });

  describe('Connect Four', () => {
    function connectFourCreds(userId: string, roomId: string) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'connect-four',
        mode: 'multi',
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'connect-four',
        roomId,
      });
      return { key, token };
    }

    // p1 (user-a) wins with a vertical line in column 0; p2 (user-b) drops
    // into column 1 between each of user-a's moves so it never blocks.
    async function playP1WinsColumnZero(
      room: Awaited<ReturnType<ColyseusTestServer['createRoom']>>,
      clientA: Awaited<ReturnType<ColyseusTestServer['connectTo']>>,
      clientB: Awaited<ReturnType<ColyseusTestServer['connectTo']>>,
    ) {
      clientA.send('drop', { col: 0 });
      await room.waitForNextPatch();
      clientB.send('drop', { col: 1 });
      await room.waitForNextPatch();
      clientA.send('drop', { col: 0 });
      await room.waitForNextPatch();
      clientB.send('drop', { col: 1 });
      await room.waitForNextPatch();
      clientA.send('drop', { col: 0 });
      await room.waitForNextPatch();
      clientB.send('drop', { col: 1 });
      await room.waitForNextPatch();
      clientA.send('drop', { col: 0 }); // p1 completes a vertical line in col 0
      await room.waitForNextPatch();
    }

    it('sends init with a null disc to a spectator/queued joiner', async () => {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'connect-four',
        mode: 'multi',
        userId: 'user-a',
        roomId: 'ROOM50',
      });
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'connect-four',
      });
      const clientA = await colyseus.connectTo(room, {
        token: connectFourCreds('user-a', 'ROOM50').token,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: connectFourCreds('user-b', 'ROOM50').token,
        roomKey: key,
      });

      const clientC = await colyseus.connectTo(room, {
        token: connectFourCreds('user-c', 'ROOM50').token,
        roomKey: key,
      });
      const [, payload] = (await clientC.waitForNextMessage()) as [
        string,
        { disc: string | null },
      ];
      expect(payload.disc).toBeNull();

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });

    it("promotes the queue head into the departing player's vacated seat on an explicit 'leave'", async () => {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'connect-four',
        mode: 'multi',
        userId: 'user-a',
        roomId: 'ROOM51',
      });
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'connect-four',
        queueEnabled: false,
      });
      const clientA = await colyseus.connectTo(room, {
        token: connectFourCreds('user-a', 'ROOM51').token,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: connectFourCreds('user-b', 'ROOM51').token,
        roomKey: key,
      });

      await playP1WinsColumnZero(room, clientA, clientB);

      clientA.send('toggle_queue', { enabled: true });
      await room.waitForNextPatch();

      const clientC = await colyseus.connectTo(room, {
        token: connectFourCreds('user-c', 'ROOM51').token,
        roomKey: key,
      });

      // user-b (the loser) sends the application-level 'leave' message
      // rather than closing the socket — this is the exact wiring the
      // ConnectFourAdapter was missing.
      clientB.send('leave');
      await room.waitForNextPatch();

      const roomInternals = room as unknown as {
        members: Array<{ userId: string; role: string }>;
      };
      expect(
        roomInternals.members.find((m) => m.userId === 'user-b'),
      ).toBeUndefined();
      expect(
        roomInternals.members.find((m) => m.userId === 'user-c')?.role,
      ).toBe('player');

      clientA.leave();
      clientC.leave();
    });
  });

  describe('Cards', () => {
    // Unlike every other adapter tested above, 'cards' requires a ruleset to
    // resolve its GameDefinition inside setup() — which loadSession() calls
    // synchronously from onCreate(). So, unlike the other games' `{ roomKey,
    // game }`-only room creation, the creating client's token (carrying the
    // ruleset) must be supplied to createRoom() itself, not just to the
    // later connectTo() calls.
    function cardsCreds(userId: string, roomId: string, ruleset: string) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'cards',
        mode: 'multi',
        userId,
        roomId,
        ruleset,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'cards',
        roomId,
        ruleset,
      });
      return { key, token };
    }

    it('sends init with a seatIndex when a player joins a truco table', async () => {
      const { key, token } = cardsCreds('user-a', 'ROOM60', 'truco');
      const room = await colyseus.createRoom('match', { roomKey: key, token });
      const client = await colyseus.connectTo(room, { token, roomKey: key });

      const [, payload] = (await client.waitForNextMessage()) as [
        string,
        { seatIndex: number | null },
      ];
      expect(payload.seatIndex).toBe(0);

      client.leave();
    });

    it("caps seats at the resolved ruleset's own seat count, not a hardcoded value", async () => {
      // truco-1v1 seats only 2 players; a 3rd joiner must become a spectator.
      // If maxPlayers were the adapter's static hardcoded value (4, matching
      // standard truco) instead of this ruleset's own definition.maxPlayers
      // (2), this 3rd joiner would incorrectly be seated as a player.
      const oneVOneKey = cardsCreds('user-a', 'ROOM61', 'truco-1v1').key;
      const oneVOneRoom = await colyseus.createRoom('match', {
        roomKey: oneVOneKey,
        token: cardsCreds('user-a', 'ROOM61', 'truco-1v1').token,
      });
      const oneVOneA = await colyseus.connectTo(oneVOneRoom, {
        token: cardsCreds('user-a', 'ROOM61', 'truco-1v1').token,
        roomKey: oneVOneKey,
      });
      const oneVOneB = await colyseus.connectTo(oneVOneRoom, {
        token: cardsCreds('user-b', 'ROOM61', 'truco-1v1').token,
        roomKey: oneVOneKey,
      });
      const oneVOneC = await colyseus.connectTo(oneVOneRoom, {
        token: cardsCreds('user-c', 'ROOM61', 'truco-1v1').token,
        roomKey: oneVOneKey,
      });
      const [, oneVOneCInit] = (await oneVOneC.waitForNextMessage()) as [
        string,
        { seatIndex: number | null },
      ];
      expect(oneVOneCInit.seatIndex).toBeNull();
      // The seatIndex above comes from CardTableSession's own per-ruleset
      // cap (definition.maxPlayers), independent of MatchRoom's seat
      // assignment — so it alone wouldn't catch MatchRoom assigning this
      // joiner the 'player' role by mistake. Assert MatchRoom's own
      // bookkeeping directly: this is what `this.maxPlayers` (the
      // setup()-returned per-instance override) actually drives.
      const oneVOneInternals = oneVOneRoom as unknown as {
        members: Array<{ userId: string; role: string }>;
      };
      expect(
        oneVOneInternals.members.find((m) => m.userId === 'user-c')?.role,
      ).toBe('spectator');

      // A standard truco table (4 seats) must NOT inherit that 2-seat cap —
      // a 3rd joiner there is still a real seated player.
      const trucoKey = cardsCreds('user-a', 'ROOM62', 'truco').key;
      const trucoRoom = await colyseus.createRoom('match', {
        roomKey: trucoKey,
        token: cardsCreds('user-a', 'ROOM62', 'truco').token,
      });
      const trucoA = await colyseus.connectTo(trucoRoom, {
        token: cardsCreds('user-a', 'ROOM62', 'truco').token,
        roomKey: trucoKey,
      });
      const trucoB = await colyseus.connectTo(trucoRoom, {
        token: cardsCreds('user-b', 'ROOM62', 'truco').token,
        roomKey: trucoKey,
      });
      const trucoC = await colyseus.connectTo(trucoRoom, {
        token: cardsCreds('user-c', 'ROOM62', 'truco').token,
        roomKey: trucoKey,
      });
      const [, trucoCInit] = (await trucoC.waitForNextMessage()) as [
        string,
        { seatIndex: number | null },
      ];
      expect(trucoCInit.seatIndex).toBe(2);
      const trucoInternals = trucoRoom as unknown as {
        members: Array<{ userId: string; role: string }>;
      };
      expect(
        trucoInternals.members.find((m) => m.userId === 'user-c')?.role,
      ).toBe('player');

      oneVOneA.leave();
      oneVOneB.leave();
      oneVOneC.leave();
      trucoA.leave();
      trucoB.leave();
      trucoC.leave();
    });

    it('actually registers a spectator with the session, not just an ack — they receive ongoing state', async () => {
      // A regression test for onJoin's non-player branch: sending the
      // `init` ack alone, without also calling `session.addPlayer` (which
      // CardTableSession internally routes to addSpectator for a seatless
      // joiner), leaves the spectator acked but never registered — no
      // snapshot now, and never included in a future broadcastMaskedState().
      const { key, token: hostToken } = cardsCreds(
        'user-a',
        'ROOM63',
        'truco-1v1',
      );
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        token: hostToken,
      });
      const clientA = await colyseus.connectTo(room, {
        token: hostToken,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: cardsCreds('user-b', 'ROOM63', 'truco-1v1').token,
        roomKey: key,
      });

      const watcher = await colyseus.connectTo(room, {
        token: cardsCreds('user-c', 'ROOM63', 'truco-1v1').token,
        roomKey: key,
      });
      let state: Record<string, unknown> | undefined;
      watcher.onMessage('state', (payload: Record<string, unknown>) => {
        state = payload;
      });
      await room.waitForNextPatch();

      expect(state).toBeDefined();

      clientA.leave();
      clientB.leave();
      watcher.leave();
    });
  });

  describe('Dominoes', () => {
    function dominoesCreds(
      userId: string,
      roomId: string,
      mode: 'single' | 'multi' = 'multi',
    ) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'dominoes-block',
        mode,
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode,
        game: 'dominoes-block',
        roomId,
      });
      return { key, token };
    }

    it('seats a single-mode joiner and starts a bot match without error', async () => {
      const { key, token } = dominoesCreds('user-a', 'ROOM05', 'single');
      const room = await colyseus.createRoom('match', { roomKey: key, token });
      const messages: unknown[] = [];
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      client.onMessage('state', (msg) => messages.push(msg));
      await room.waitForNextPatch();

      expect(messages.length).toBeGreaterThan(0);

      client.leave();
    });

    it('actually registers a spectator with the session, not just an ack — they receive ongoing state', async () => {
      // Mirrors the Cards/CardTableSession regression test: onJoin's
      // non-player branch must not just ack-and-return. DominoesSession's
      // addPlayer() internally routes a seatless caller to addSpectator()
      // (the same pattern as CardTableSession), so calling it for a
      // spectator is what actually gets them a snapshot now and every
      // future broadcastState() — an ack alone leaves them acked but never
      // registered.
      const { key, token: hostToken } = dominoesCreds('user-a', 'ROOM64');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        token: hostToken,
      });
      const clientA = await colyseus.connectTo(room, {
        token: hostToken,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: dominoesCreds('user-b', 'ROOM64').token,
        roomKey: key,
      });

      const watcher = await colyseus.connectTo(room, {
        token: dominoesCreds('user-c', 'ROOM64').token,
        roomKey: key,
      });
      let state: Record<string, unknown> | undefined;
      watcher.onMessage('state', (payload: Record<string, unknown>) => {
        state = payload;
      });
      await room.waitForNextPatch();

      expect(state).toBeDefined();

      clientA.leave();
      clientB.leave();
      watcher.leave();
    });
  });

  describe('Minesweeper', () => {
    function minesweeperCreds(userId: string, roomId: string) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'minesweeper-versus',
        mode: 'multi',
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
        game: 'minesweeper-versus',
        roomId,
      });
      return { key, token };
    }

    it('seats a player into a minesweeper-versus room and returns the board on init', async () => {
      const { key, token } = minesweeperCreds('user-a', 'ROOM06');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'minesweeper-versus',
      });
      const messages: unknown[] = [];
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      client.onMessage('init', (msg) => messages.push(msg));
      await room.waitForNextPatch();
      expect(messages.length).toBeGreaterThan(0);
      expect((messages[0] as { grid: unknown }).grid).toBeTruthy();

      client.leave();
    });

    it('sends the board snapshot to a spectator/queued joiner without granting them reveal permission', async () => {
      // Unlike CardTableSession/DominoesSession, MinesweeperSession.addPlayer()
      // has no internal seat-capacity check or spectator routing — it
      // unconditionally pushes onto `this.players`, which is exactly what
      // `reveal()` checks to authorize a tile click and what
      // `recordResult()` uses for gamification scoring. Calling it for a
      // non-player seat would silently let a spectator reveal tiles and be
      // scored, so onJoin must only send the one-time init ack for them.
      const { key, token: tokenA } = minesweeperCreds('user-a', 'ROOM06b');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'minesweeper-versus',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: minesweeperCreds('user-b', 'ROOM06b').token,
        roomKey: key,
      });
      const clientC = await colyseus.connectTo(room, {
        token: minesweeperCreds('user-c', 'ROOM06b').token,
        roomKey: key,
      });

      const messages: unknown[] = [];
      clientC.onMessage('init', (msg) => messages.push(msg));
      await room.waitForNextPatch();
      expect(messages.length).toBeGreaterThan(0);
      expect((messages[0] as { grid: unknown }).grid).toBeTruthy();

      const errors: unknown[] = [];
      clientC.onMessage('reveal_error', (msg) => errors.push(msg));
      clientC.send('reveal', { x: 0, y: 0 });
      await room.waitForNextPatch();
      expect(errors).toEqual([{ message: 'not_in_session' }]);

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });

    it('delivers a live reveal broadcast to a spectator after a player reveals a tile — no separate spectator broadcast path needed', async () => {
      // Same finding as Word Chain above: minesweeperAdapter.ts's
      // broadcaster is wired to ctx.broadcast() (Colyseus's room-wide
      // Room.broadcast()), which already reaches every connected client —
      // spectators included — with no extra code. The plan's Task 25
      // assumed a CardTableSession-style addSpectator()/masked-broadcast
      // extension was needed; it isn't, because Minesweeper never masks
      // per-viewer the way Battleship does (its board is public to
      // everyone once revealed).
      const { key, token: tokenA } = minesweeperCreds('user-a', 'ROOM06c');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'minesweeper-versus',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: minesweeperCreds('user-b', 'ROOM06c').token,
        roomKey: key,
      });
      const clientC = await colyseus.connectTo(room, {
        token: minesweeperCreds('user-c', 'ROOM06c').token,
        roomKey: key,
      });
      await room.waitForNextPatch();

      const spectatorReveals: { userId: string }[] = [];
      clientC.onMessage('reveal', (msg: { userId: string }) =>
        spectatorReveals.push(msg),
      );

      clientA.send('reveal', { x: 0, y: 0 });
      await room.waitForNextPatch();

      expect(spectatorReveals.length).toBeGreaterThan(0);
      expect(spectatorReveals[0]!.userId).toBe('user-a');

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });
  });

  describe('Snake', () => {
    function snakeCreds(
      userId: string,
      roomId: string,
      mode: 'single' | 'multi' = 'multi',
    ) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'snake-game',
        mode,
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode,
        game: 'snake-game',
        roomId,
      });
      return { key, token };
    }

    it('seats a player into a snake-game room and returns their playerId on init', async () => {
      const { key, token } = snakeCreds('user-a', 'ROOM07');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'snake-game',
      });
      const messages: unknown[] = [];
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      client.onMessage('init', (msg) => messages.push(msg));
      await room.waitForNextPatch();
      expect(messages.length).toBeGreaterThan(0);
      expect((messages[0] as { playerId: unknown }).playerId).toBeTruthy();

      client.leave();
    });

    it('registers a spectator with the session (init ack has playerId: null) without granting them snake control', async () => {
      // SnakeSession.addPlayer() carries its own capacity check
      // (`this.players.length >= 2`) independent of MatchRoom's own seat
      // bookkeeping. MatchRoom.assignSeat() only ever hands out 'spectator'
      // once 2 members already hold 'player' — so by the time a spectator's
      // onJoin runs, SnakeSession.players is already full and addPlayer()
      // returns null without pushing an entry or calling engine.addSnake().
      // That makes it safe to call unconditionally (the CardTable/Dominoes
      // pattern), unlike MinesweeperSession, which has no such capacity
      // check and would let a spectator's addPlayer call actually enroll
      // them as a real participant. Proven below: a spectator's `input`
      // never adds a 3rd key to the engine state's `snakes` map, and does
      // not error.
      const { key, token: tokenA } = snakeCreds('user-a', 'ROOM07b');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'snake-game',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: snakeCreds('user-b', 'ROOM07b').token,
        roomKey: key,
      });
      const clientC = await colyseus.connectTo(room, {
        token: snakeCreds('user-c', 'ROOM07b').token,
        roomKey: key,
      });

      const initMessages: unknown[] = [];
      clientC.onMessage('init', (msg) => initMessages.push(msg));
      await room.waitForNextPatch();
      expect(initMessages.length).toBeGreaterThan(0);
      expect((initMessages[0] as { playerId: unknown }).playerId).toBeNull();

      let lastState: { snakes: Record<string, unknown> } | undefined;
      clientC.onMessage(
        'state',
        (msg: { state: { snakes: Record<string, unknown> } }) => {
          lastState = msg.state;
        },
      );
      clientC.send('input', { direction: 'up' });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(lastState).toBeDefined();
      expect(Object.keys(lastState!.snakes).sort()).toEqual([
        'player1',
        'player2',
      ]);

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });

    it('rejects a malformed direction instead of forwarding it into the engine', async () => {
      // Regression test: SnakeSession.handleInput() forwards whatever
      // string it's given straight into SnakeEngine.setDirection() ->
      // movePoint()'s `directionMap[direction]` lookup, which runs inside
      // the session's own `setInterval` tick loop on the *next* tick — not
      // inside this message handler's call stack, so no per-message
      // try/catch here would ever catch it. An invalid key makes
      // `directionMap[direction]` `undefined`, and the next line's
      // `delta.dx` throws — with nothing upstream to catch it, this used to
      // crash the whole process for any connected client (player, not just
      // spectator) sending a bogus `direction`. The adapter must reject an
      // invalid direction before it ever reaches `session.handleInput`.
      const { key, token: tokenA } = snakeCreds('user-a', 'ROOM07c');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'snake-game',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: snakeCreds('user-b', 'ROOM07c').token,
        roomKey: key,
      });
      await room.waitForNextPatch();

      const errors: unknown[] = [];
      clientA.onMessage('input_error', (msg) => errors.push(msg));
      clientA.send('input', { direction: 'garbage' });
      clientA.send('input', {});
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(errors.length).toBe(2);

      // Proves the room/session survived: a state broadcast still arrives
      // after the malformed messages, and both snakes are still present.
      let lastState: { snakes: Record<string, unknown> } | undefined;
      clientA.onMessage(
        'state',
        (msg: { state: { snakes: Record<string, unknown> } }) => {
          lastState = msg.state;
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(lastState).toBeDefined();
      expect(Object.keys(lastState!.snakes).sort()).toEqual([
        'player1',
        'player2',
      ]);

      clientA.leave();
      clientB.leave();
    });
  });

  describe('Tower Unstable', () => {
    function towerCreds(
      userId: string,
      roomId: string,
      mode: 'single' | 'multi' = 'multi',
    ) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'tower-unstable',
        mode,
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode,
        game: 'tower-unstable',
        roomId,
      });
      return { key, token };
    }

    it('seats a player into a tower-unstable room and returns state on init', async () => {
      const { key, token } = towerCreds('user-a', 'ROOM08');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'tower-unstable',
      });
      const messages: unknown[] = [];
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      client.onMessage('init', (msg) => messages.push(msg));
      await room.waitForNextPatch();
      expect(messages.length).toBeGreaterThan(0);
      expect((messages[0] as { joined: unknown }).joined).toBe(true);

      client.leave();
    });

    it('registers a spectator with the session (init ack has joined: false) without granting them a seat', async () => {
      // TowerSession.addPlayer() carries its own capacity check
      // (`this.players.length >= MAX_PLAYERS`), independent of MatchRoom's
      // own seat bookkeeping. MatchRoom.assignSeat() only ever hands out a
      // non-'player' role once 2 members already hold 'player' — so by the
      // time a spectator's onJoin runs, TowerSession.players is already
      // full and addPlayer() returns false without pushing an entry. That
      // makes it safe to call unconditionally (the Snake/CardTable/Dominoes
      // pattern), unlike MinesweeperSession, which has no such capacity
      // check. Proven below: the spectator's init ack reports
      // `joined: false`, and the engine's turnOrder still lists only the 2
      // real players.
      const { key, token: tokenA } = towerCreds('user-a', 'ROOM08b');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'tower-unstable',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: towerCreds('user-b', 'ROOM08b').token,
        roomKey: key,
      });
      const clientC = await colyseus.connectTo(room, {
        token: towerCreds('user-c', 'ROOM08b').token,
        roomKey: key,
      });

      const initMessages: unknown[] = [];
      clientC.onMessage('init', (msg) => initMessages.push(msg));
      await room.waitForNextPatch();
      expect(initMessages.length).toBeGreaterThan(0);
      const ack = initMessages[0] as {
        joined: unknown;
        state: { turnOrder: string[] } | null;
      };
      expect(ack.joined).toBe(false);
      expect(ack.state?.turnOrder.sort()).toEqual(['user-a', 'user-b']);

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });

    it('rejects a non-integer pull payload instead of forwarding it into the engine', async () => {
      // Regression guard: TowerEngine.pull()'s bounds checks are plain `<`
      // comparisons, which a non-numeric value coerces past harmlessly, but
      // a well-typed non-integer number (e.g. `level: 3.5`) sails through
      // them and then indexes `this.levels[level]` with a non-canonical
      // key, which returns `undefined` — the next `.blocks` access throws a
      // TypeError with nothing upstream to catch it, crashing the whole
      // process. The adapter must reject malformed coordinates before they
      // ever reach `session.handlePull`.
      const { key, token: tokenA } = towerCreds('user-a', 'ROOM08c');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'tower-unstable',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: towerCreds('user-b', 'ROOM08c').token,
        roomKey: key,
      });
      await room.waitForNextPatch();

      const errors: unknown[] = [];
      clientA.onMessage(ACTION_REJECTED, (msg) => errors.push(msg));
      clientA.send('pull', { level: 3.5, position: 0 });
      clientA.send('pull', { level: 'not-a-number', position: 0 });
      clientA.send('pull', {});
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(errors.length).toBe(3);
      expect((errors[0] as { error: string }).error).toBe(
        'Invalid pull coordinates',
      );

      // Proves the room/session survived: a fresh client can still connect
      // and get seated as a spectator.
      const clientD = await colyseus.connectTo(room, {
        token: towerCreds('user-d', 'ROOM08c').token,
        roomKey: key,
      });
      const laterMessages: unknown[] = [];
      clientD.onMessage('init', (msg) => laterMessages.push(msg));
      await room.waitForNextPatch();
      expect(laterMessages.length).toBeGreaterThan(0);

      clientA.leave();
      clientB.leave();
      clientD.leave();
    });
  });

  describe('Trivia Quiz', () => {
    function triviaCreds(
      userId: string,
      roomId: string,
      mode: 'single' | 'multi' = 'multi',
    ) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'trivia-quiz',
        mode,
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode,
        game: 'trivia-quiz',
        roomId,
      });
      return { key, token };
    }

    it('seats a player into a trivia-quiz room and returns playerScores/leaderboard on init', async () => {
      const { key, token } = triviaCreds('user-a', 'ROOM09');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'trivia-quiz',
      });
      const messages: unknown[] = [];
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      client.onMessage('init', (msg) => messages.push(msg));
      await room.waitForNextPatch();
      expect(messages.length).toBeGreaterThan(0);
      const ack = messages[0] as {
        playerScores: unknown[];
        leaderboard: unknown[];
      };
      expect(ack.playerScores).toBeDefined();
      expect(ack.leaderboard).toBeDefined();

      client.leave();
    });

    it('acks a spectator with playerScores/leaderboard without enrolling them as a scoring player', async () => {
      // TriviaQuizSession.addPlayer() has no seat-capacity check matching
      // MatchRoom's `maxPlayers: 2` gate — its own internal cap is 8 (see
      // TriviaQuizEngine.addPlayer()'s `this.state.players.size >= 8`), and
      // it unconditionally registers whatever userId it's given with the
      // engine (scored, included in playerScores/leaderboard). That's the
      // same unsafe-to-call-unconditionally shape as MinesweeperSession,
      // not Snake/Tower/CardTable/Dominoes (whose internal cap equals
      // maxPlayers, making a spectator's addPlayer call a guaranteed
      // no-op). So a 3rd joiner here must never reach addPlayer() at all.
      const { key, token: tokenA } = triviaCreds('user-a', 'ROOM09b');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'trivia-quiz',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: triviaCreds('user-b', 'ROOM09b').token,
        roomKey: key,
      });
      const clientC = await colyseus.connectTo(room, {
        token: triviaCreds('user-c', 'ROOM09b').token,
        roomKey: key,
      });

      const initMessages: unknown[] = [];
      clientC.onMessage('init', (msg) => initMessages.push(msg));
      await room.waitForNextPatch();
      expect(initMessages.length).toBeGreaterThan(0);
      const ack = initMessages[0] as {
        playerScores: { userId: string }[];
        leaderboard: { userId: string }[];
      };
      expect(ack.playerScores.map((p) => p.userId).sort()).toEqual([
        'user-a',
        'user-b',
      ]);
      expect(ack.leaderboard.map((p) => p.userId).sort()).toEqual([
        'user-a',
        'user-b',
      ]);

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });

    it('delivers a live state_update broadcast to a spectator after a player answers — no separate spectator broadcast path needed', async () => {
      // Same finding as Word Chain/Minesweeper above: triviaQuizAdapter.ts's
      // broadcaster is wired to ctx.broadcast() (Colyseus's room-wide
      // Room.broadcast()), reaching every connected client including
      // spectators with no extra code. The plan's Task 27 assumed a new
      // spectator broadcast path was needed; it wasn't.
      const { key, token: tokenA } = triviaCreds('user-a', 'ROOM09d');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'trivia-quiz',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: triviaCreds('user-b', 'ROOM09d').token,
        roomKey: key,
      });
      const clientC = await colyseus.connectTo(room, {
        token: triviaCreds('user-c', 'ROOM09d').token,
        roomKey: key,
      });
      await room.waitForNextPatch();

      const spectatorStates: unknown[] = [];
      clientC.onMessage('state_update', (msg) => spectatorStates.push(msg));

      clientA.send('answer', { answerIndex: 0 });
      await room.waitForNextPatch();

      expect(spectatorStates.length).toBeGreaterThan(0);

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });

    it('advances the question when a leave message drops a player who never answered', async () => {
      // Regression test: the original TriviaQuizRoom.ts registered no
      // `this.onMessage('leave', ...)` handler at all, even though
      // TriviaQuizSession already exposes a `leave(userId, connection)`
      // method (delegating to pauseForDisconnect) that every other
      // completed adapter's session wires up to a `leave` message. Without
      // it, a player who explicitly leaves mid-question still counts as
      // "connected" for checkAllAnswered()'s purposes, so the other player
      // answering alone can never advance the question — the room stalls
      // forever waiting on a player who said they were leaving.
      const { key, token: tokenA } = triviaCreds('user-a', 'ROOM09c');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'trivia-quiz',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: triviaCreds('user-b', 'ROOM09c').token,
        roomKey: key,
      });
      await room.waitForNextPatch();

      const stateUpdates: { currentQuestionIndex: number }[] = [];
      clientB.onMessage(
        'state_update',
        (msg: { currentQuestionIndex: number }) => stateUpdates.push(msg),
      );

      clientA.send('leave');
      await new Promise((resolve) => setTimeout(resolve, 100));

      // q1's correctIndex is 1 ("Paris") per
      // src/services/activity/trivia-quiz/questions.ts.
      clientB.send('answer', { answerIndex: 1 });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(stateUpdates.some((s) => s.currentQuestionIndex === 1)).toBe(true);

      clientA.leave();
      clientB.leave();
    });

    it('does not crash on an out-of-range or non-integer answerIndex, and still accepts a later valid answer', async () => {
      // TriviaQuizEngine.submitAnswer() guards with a plain relational
      // bounds check (`answerIndex < 0 || answerIndex >= question.options
      // .length`) and never uses `answerIndex` to index an array — only in
      // `===` comparisons against `correctIndex` — so an out-of-range value
      // (e.g. 999) is safely rejected (`submitAnswer` returns false, no
      // state change) and a well-typed non-integer (e.g. 1.5) is safely
      // accepted as an incorrect answer (0 points), unlike the
      // Snake/TowerUnstable class of bug where a non-integer reached a raw
      // array index and threw. No adapter-level integer/range guard is
      // needed beyond the brief's `typeof`/`< 0` check.
      const { key, token: tokenA } = triviaCreds('user-a', 'ROOM09d');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'trivia-quiz',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: triviaCreds('user-b', 'ROOM09d').token,
        roomKey: key,
      });
      await room.waitForNextPatch();

      const stateUpdates: {
        playerScores: { userId: string; score: number }[];
      }[] = [];
      clientA.onMessage(
        'state_update',
        (msg: { playerScores: { userId: string; score: number }[] }) =>
          stateUpdates.push(msg),
      );

      clientA.send('answer', { answerIndex: 999 });
      clientA.send('answer', { answerIndex: 1.5 });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Proves the room/process survived: a fresh client can still connect
      // and get seated as a spectator with a valid ack.
      const clientC = await colyseus.connectTo(room, {
        token: triviaCreds('user-c', 'ROOM09d').token,
        roomKey: key,
      });
      const laterMessages: unknown[] = [];
      clientC.onMessage('init', (msg) => laterMessages.push(msg));
      await room.waitForNextPatch();
      expect(laterMessages.length).toBeGreaterThan(0);

      // Proves the malformed submissions above never consumed user-b's
      // answer slot for the question: user-b can still submit the correct
      // answer and score points for it.
      clientB.send('answer', { answerIndex: 1 });
      await new Promise((resolve) => setTimeout(resolve, 200));

      const userBScore = stateUpdates
        .flatMap((s) => s.playerScores)
        .filter((p) => p.userId === 'user-b')
        .at(-1)?.score;
      expect(userBScore).toBeGreaterThan(0);

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });
  });

  describe('Word Chain', () => {
    function wordChainCreds(
      userId: string,
      roomId: string,
      mode: 'single' | 'multi' = 'multi',
    ) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'word-chain',
        mode,
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode,
        game: 'word-chain',
        roomId,
      });
      return { key, token };
    }

    it('seats a player into a word-chain room and returns the current word on init', async () => {
      const { key, token } = wordChainCreds('user-a', 'ROOM10');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'word-chain',
      });
      const messages: unknown[] = [];
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      client.onMessage('init', (msg) => messages.push(msg));
      await room.waitForNextPatch();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toHaveProperty('currentWord');

      client.leave();
    });

    it('acks a spectator/queued joiner with the current state without enrolling them as a turn-taking player', async () => {
      // WordChainSession.addPlayer() has no seat-capacity check of its
      // own — unlike CardTable/Dominoes/Snake/TowerUnstable (whose internal
      // cap equals maxPlayers, making a spectator's addPlayer call a
      // guaranteed no-op) — it unconditionally pushes the caller onto
      // `this.players` and `engine.addPlayer()`, enrolling them in
      // `state.players` and the turn order, same as
      // MinesweeperSession/TriviaQuizSession. So a 3rd joiner here must
      // never reach addPlayer(). Proven below: the 3rd joiner is absent
      // from `players` in their own init ack, and submitting a word as
      // them is rejected with "Not your turn" rather than being accepted
      // or crashing.
      const { key, token: tokenA } = wordChainCreds('user-a', 'ROOM10b');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'word-chain',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: wordChainCreds('user-b', 'ROOM10b').token,
        roomKey: key,
      });
      const clientC = await colyseus.connectTo(room, {
        token: wordChainCreds('user-c', 'ROOM10b').token,
        roomKey: key,
      });

      const initMessages: unknown[] = [];
      clientC.onMessage('init', (msg) => initMessages.push(msg));
      await room.waitForNextPatch();
      expect(initMessages.length).toBeGreaterThan(0);
      const ack = initMessages[0] as { players: { userId: string }[] };
      expect(ack.players.map((p) => p.userId).sort()).toEqual([
        'user-a',
        'user-b',
      ]);

      const rejections: { error: string }[] = [];
      clientC.onMessage(ACTION_REJECTED, (msg: { error: string }) =>
        rejections.push(msg),
      );
      clientC.send('word', { word: 'abelha' });
      await room.waitForNextPatch();
      expect(rejections).toEqual([{ error: 'Not your turn' }]);

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });

    it('delivers a live state broadcast to a spectator after a player submits a word — no separate spectator broadcast path needed', async () => {
      // Task 29 in the client plan assumed word-chain (like Battleship)
      // needed a NEW spectator-only broadcast path, modeled on
      // CardTableSession's addSpectator()/broadcastMaskedState() pattern.
      // It doesn't: WordChainSession's broadcaster.broadcast() is wired to
      // ctx.broadcast() in wordChainAdapter.ts's setup(), which is
      // Colyseus's own Room.broadcast() (MatchRoom.ts) — that reaches
      // every connected client in the room already, spectators included,
      // with no player-registration filtering. The one-time `init` ack a
      // spectator gets on join (tested above) was the only genuinely
      // missing piece, and it already existed before this test. This test
      // is the "prove it" companion to that reasoning: a spectator
      // receives the SAME 'state' broadcast a player's word submission
      // triggers, without ever being registered as a player.
      const { key, token: tokenA } = wordChainCreds('user-a', 'ROOM10d');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'word-chain',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: wordChainCreds('user-b', 'ROOM10d').token,
        roomKey: key,
      });
      const clientC = await colyseus.connectTo(room, {
        token: wordChainCreds('user-c', 'ROOM10d').token,
        roomKey: key,
      });
      await room.waitForNextPatch();

      const spectatorStates: { currentWord: string }[] = [];
      clientC.onMessage('state', (msg: { currentWord: string }) =>
        spectatorStates.push(msg),
      );

      // currentTurn starts as '' (WordChainEngine.ts) and is claimed by
      // whichever seated player submits first, so clientA can move
      // unconditionally here without first inspecting whose turn it is.
      clientA.send('word', { word: 'abelha' });
      await room.waitForNextPatch();

      expect(spectatorStates.length).toBeGreaterThan(0);
      expect(spectatorStates[0]!.currentWord).toBe('abelha');

      clientA.leave();
      clientB.leave();
      clientC.leave();
    });

    it('rejects a non-string word payload instead of throwing inside the engine', async () => {
      // WordChainEngine.submitWord() calls `word.trim().toLowerCase()`
      // unconditionally, so a non-string `word` reaching it (a number or
      // object survives the adapter's `?? ''`, which only replaces
      // null/undefined) would throw a TypeError instead of returning a
      // clean rejection. The adapter must guard with a `typeof` check
      // before calling handleWordSubmission.
      const { key, token: tokenA } = wordChainCreds('user-a', 'ROOM10c');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'word-chain',
      });
      const clientA = await colyseus.connectTo(room, {
        token: tokenA,
        roomKey: key,
      });
      const clientB = await colyseus.connectTo(room, {
        token: wordChainCreds('user-b', 'ROOM10c').token,
        roomKey: key,
      });
      await room.waitForNextPatch();

      const rejections: { error: string }[] = [];
      clientA.onMessage(ACTION_REJECTED, (msg: { error: string }) =>
        rejections.push(msg),
      );
      clientA.send('word', { word: 12345 });
      await room.waitForNextPatch();
      expect(rejections).toEqual([{ error: 'Invalid word' }]);

      // Proves the room/process survived: a well-typed word from the same
      // player is still accepted afterward.
      clientA.send('word', { word: 'abelha' });
      await room.waitForNextPatch();
      expect(rejections).toEqual([{ error: 'Invalid word' }]);

      clientA.leave();
      clientB.leave();
    });
  });

  describe('Wordle Race', () => {
    function wordleRaceCreds(
      userId: string,
      roomId: string,
      mode: 'single' | 'multi' = 'multi',
    ) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'wordle-race',
        mode,
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode,
        game: 'wordle-race',
        roomId,
      });
      return { key, token };
    }

    it('seats a player into a wordle-race room and returns the target word length on init', async () => {
      const { key, token } = wordleRaceCreds('user-a', 'ROOM11');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'wordle-race',
      });
      const messages: unknown[] = [];
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      client.onMessage('init', (msg) => messages.push(msg));
      await room.waitForNextPatch();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toHaveProperty('targetWordLength');

      client.leave();
    });

    it('acks a spectator joiner with a degraded state snapshot without enrolling them as a racer', async () => {
      // WordleRaceSession.addPlayer() has no seat-capacity check of its
      // own — it unconditionally pushes the caller onto `this.players` and
      // `engine.addPlayer()`, permanently enrolling them in
      // `state.players`. Since `isGameOver()` requires every enrolled
      // player to be solved or exhausted, a spectator who never guesses
      // would block the race from ever ending. So the 9th joiner here (the
      // adapter's maxPlayers is 8) must never reach addPlayer(). Proven
      // below: the spectator's own init ack has empty/default
      // `currentPlayer*` fields (they're absent from the engine's player
      // map), and submitting a guess as them is rejected with "Player not
      // in room" rather than being accepted or crashing.
      const roomId = 'ROOM11b';
      const { key, token: tokenA } = wordleRaceCreds('user-a', roomId);
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'wordle-race',
      });
      const clients = [
        await colyseus.connectTo(room, { token: tokenA, roomKey: key }),
      ];
      for (let i = 1; i < 8; i++) {
        clients.push(
          await colyseus.connectTo(room, {
            token: wordleRaceCreds(`user-${i}`, roomId).token,
            roomKey: key,
          }),
        );
      }
      const spectatorToken = wordleRaceCreds('user-spectator', roomId).token;
      const spectator = await colyseus.connectTo(room, {
        token: spectatorToken,
        roomKey: key,
      });

      const initMessages: unknown[] = [];
      spectator.onMessage('init', (msg) => initMessages.push(msg));
      await room.waitForNextPatch();
      expect(initMessages.length).toBeGreaterThan(0);
      const ack = initMessages[0] as {
        currentPlayerGuesses: unknown[];
        currentPlayerSolved: boolean;
        currentPlayerExhausted: boolean;
      };
      expect(ack.currentPlayerGuesses).toEqual([]);
      expect(ack.currentPlayerSolved).toBe(false);
      expect(ack.currentPlayerExhausted).toBe(false);

      const rejections: { error: string }[] = [];
      spectator.onMessage(ACTION_REJECTED, (msg: { error: string }) =>
        rejections.push(msg),
      );
      spectator.send('guess', { guess: 'abrir' });
      await room.waitForNextPatch();
      expect(rejections).toEqual([{ error: 'Player not in room' }]);

      for (const c of clients) c.leave();
      spectator.leave();
    });

    it('rejects a non-string guess payload instead of throwing inside the engine', async () => {
      // WordleRaceEngine.submitGuess() calls `guess.trim().toLowerCase()`
      // unconditionally, so a non-string `guess` reaching it (a number or
      // object survives the adapter's `?? ''`, which only replaces
      // null/undefined) would throw a TypeError instead of returning a
      // clean rejection. The adapter must guard with a `typeof` check
      // before calling submitGuess.
      const { key, token } = wordleRaceCreds('user-a', 'ROOM11c');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'wordle-race',
      });
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      await room.waitForNextPatch();

      const rejections: { error: string }[] = [];
      client.onMessage(ACTION_REJECTED, (msg: { error: string }) =>
        rejections.push(msg),
      );
      client.send('guess', { guess: 12345 });
      await room.waitForNextPatch();
      expect(rejections).toEqual([{ error: 'Invalid guess' }]);

      // Proves the room/process survived: a well-typed guess from the same
      // player is still accepted afterward (no further rejection queued
      // for the malformed-length case, since 12345 has fewer digits than
      // most target words but that's incidental — the point is no crash).
      client.send('guess', { guess: 'abrir' });
      await room.waitForNextPatch();
      expect(rejections).toEqual([{ error: 'Invalid guess' }]);

      client.leave();
    });

    it('ends the race once every real player is exhausted, with a spectator connected throughout', async () => {
      // Direct, end-to-end companion to the "acks a spectator" test above:
      // that test proves the spectator was never enrolled (their guess is
      // rejected with "Player not in room"), which is strong indirect
      // evidence addPlayer() was skipped for them — but it never actually
      // drives WordleRaceEngine.isGameOver() to true, so it doesn't prove
      // the spectator's presence is harmless to the game actually
      // concluding. This test does: it fills all 8 player seats, connects
      // a 9th (spectator) client, then exhausts every real player's
      // MAX_ATTEMPTS (6, per WordleRaceEngine.ts) with 6 distinct
      // known-valid, off-target guesses each, and asserts a `game_ended`
      // broadcast still reaches the spectator. Solving instead of
      // exhausting isn't used to reach the terminal state — getGameState()
      // never exposes the target word, only its length — but a guess
      // accidentally matching the (randomly picked) target word is still
      // fine: `solved` is just as terminal to isGameOver() as `exhausted`.
      const roomId = 'ROOM11e';
      const { key, token: tokenA } = wordleRaceCreds('user-a', roomId);
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'wordle-race',
      });
      const players = [
        await colyseus.connectTo(room, { token: tokenA, roomKey: key }),
      ];
      for (let i = 1; i < 8; i++) {
        players.push(
          await colyseus.connectTo(room, {
            token: wordleRaceCreds(`user-${i}`, roomId).token,
            roomKey: key,
          }),
        );
      }
      const spectator = await colyseus.connectTo(room, {
        token: wordleRaceCreds('user-spectator', roomId).token,
        roomKey: key,
      });
      await room.waitForNextPatch();

      const gameEndedMessages: unknown[] = [];
      spectator.onMessage('game_ended', (msg) => gameEndedMessages.push(msg));

      // Five-letter words confirmed to resolve via resolveCanonical() in
      // the validation bank (valid-guesses.txt) — distinct per player, so
      // none trips the "Already guessed this word" rejection that would
      // otherwise skip incrementing `attempts`. Sent in two batches of 3
      // per player with a pause in between: the adapter's own `guess`
      // handler is rate-limited to GUESS_RATE_LIMIT_MAX (3) per
      // GUESS_RATE_LIMIT_WINDOW_MS (1000) — sending all 6 back-to-back
      // would silently drop the last 3 rather than incrementing attempts.
      const guesses = ['abrir', 'acaso', 'aceno', 'aceso', 'aceto', 'achar'];
      for (const player of players) {
        for (const guess of guesses.slice(0, 3)) {
          player.send('guess', { guess });
          await room.waitForNextPatch();
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1100));
      for (const player of players) {
        for (const guess of guesses.slice(3)) {
          player.send('guess', { guess });
          await room.waitForNextPatch();
        }
      }

      expect(gameEndedMessages.length).toBeGreaterThan(0);
      const ended = gameEndedMessages[0] as {
        results: { userId: string; position: number; solved: boolean }[];
      };
      expect(ended.results.map((r) => r.userId).sort()).toEqual(
        players.map((_, i) => (i === 0 ? 'user-a' : `user-${i}`)).sort(),
      );
      // The spectator was never enrolled, so they must be absent from the
      // final results even though they were connected the whole time.
      expect(ended.results.some((r) => r.userId === 'user-spectator')).toBe(
        false,
      );

      for (const c of players) c.leave();
      spectator.leave();
    }, 20000);
  });

  describe('Wordle', () => {
    function wordleCreds(
      userId: string,
      roomId: string,
      guildId = 'guild-1',
      mode: 'single' | 'multi' = 'multi',
    ) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'wordle',
        mode,
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId,
        mode,
        game: 'wordle',
        roomId,
      });
      return { key, token };
    }

    it('seats a player into a wordle room and returns the daily word length on init', async () => {
      const { key, token } = wordleCreds(
        'user-a',
        'ROOM12',
        'guild-wordle-init',
      );
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'wordle',
      });
      const messages: unknown[] = [];
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      client.onMessage('init', (msg) => messages.push(msg));
      await room.waitForNextPatch();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toHaveProperty('wordLength');
      expect(
        (messages[0] as { wordLength: number }).wordLength,
      ).toBeGreaterThanOrEqual(5);

      client.leave();
    });

    it('rejects a non-string guess payload instead of throwing inside the service', async () => {
      // WordleService.submitGuess() -> resolveCanonical() calls
      // `guess.trim().toLowerCase()` unconditionally, so a non-string
      // `guess` reaching it (a number or object survives the adapter's
      // `?? ''`, which only replaces null/undefined) would throw a
      // TypeError instead of returning a clean rejection. The adapter must
      // guard with a `typeof` check before calling submitGuess.
      const { key, token } = wordleCreds(
        'user-a',
        'ROOM12b',
        'guild-wordle-badguess',
      );
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'wordle',
      });
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      await room.waitForNextPatch();

      const errors: { message: string }[] = [];
      client.onMessage('guess_error', (msg: { message: string }) =>
        errors.push(msg),
      );
      client.send('guess', { guess: 12345 });
      await room.waitForNextPatch();
      expect(errors).toEqual([{ message: 'Invalid guess' }]);

      client.leave();
    });

    it('acks the 65th connected client as a non-player with a default init instead of silence', async () => {
      // maxPlayers: 64 makes a direct 65-client join into wordle unlikely
      // in practice, but it's genuinely reachable without any simultaneity:
      // MatchRoom.switchGame() re-seats every currently-connected client
      // (assignSeat() runs fresh for each, comparing the live player count
      // against the *new* adapter's maxPlayers) whenever a room switches
      // into wordle — a room that organically accumulated 65+ clients
      // under a different, uncapped game would produce exactly this
      // non-player seat on switch. WordleService has no player-
      // registration concept to skip for a spectator (confirmed in this
      // task's investigation), so onJoin now sends the same `init` shape a
      // real player gets, with safe defaults, instead of nothing at all.
      const roomId = 'ROOM12c';
      const guildId = 'guild-wordle-overflow';
      const { key, token: firstToken } = wordleCreds('user-0', roomId, guildId);
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'wordle',
      });

      const clients = [
        await colyseus.connectTo(room, { token: firstToken, roomKey: key }),
      ];
      for (let i = 1; i < 64; i++) {
        clients.push(
          await colyseus.connectTo(room, {
            token: wordleCreds(`user-${i}`, roomId, guildId).token,
            roomKey: key,
          }),
        );
      }

      const spectatorToken = wordleCreds(
        'user-spectator',
        roomId,
        guildId,
      ).token;
      const spectator = await colyseus.connectTo(room, {
        token: spectatorToken,
        roomKey: key,
      });

      const initMessages: unknown[] = [];
      spectator.onMessage('init', (msg) => initMessages.push(msg));
      await room.waitForNextPatch();

      expect(initMessages.length).toBeGreaterThan(0);
      expect(initMessages[0]).toEqual({
        wordLength: expect.any(Number),
        guesses: [],
        solved: false,
        attempts: 0,
      });

      for (const c of clients) c.leave();
      spectator.leave();
    }, 30000);
  });

  describe('Word Search Race', () => {
    function wordSearchRaceCreds(
      userId: string,
      roomId: string,
      mode: 'single' | 'multi' = 'multi',
    ) {
      const key = roomKey({
        instanceId: 'inst-1',
        game: 'word-search-race',
        mode,
        userId,
        roomId,
      });
      const token = mintWsSessionToken({
        userId,
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode,
        game: 'word-search-race',
        roomId,
      });
      return { key, token };
    }

    it('seats a player into a word-search-race room and returns the grid on init', async () => {
      const { key, token } = wordSearchRaceCreds('user-a', 'ROOM13');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'word-search-race',
      });
      const messages: unknown[] = [];
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      client.onMessage('init', (msg) => messages.push(msg));
      await room.waitForNextPatch();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toHaveProperty('grid');

      client.leave();
    });

    it('acks a spectator joiner with the shared public state without enrolling them as a racer', async () => {
      // WordSearchRaceSession.addPlayer() has no seat-capacity check of its
      // own — unconditionally pushed onto `this.players`, which
      // `recordResult()` iterates for gamification scoring at game end and
      // which the empty-room grace timer relies on staying accurate. So a
      // non-player seat here must never reach addPlayer(). Proven below:
      // filling all 8 player seats, then a 9th joiner is seated as a
      // spectator and their `select` is rejected with 'Player not in room'
      // rather than being accepted.
      const roomId = 'ROOM13b';
      const { key, token: tokenA } = wordSearchRaceCreds('user-a', roomId);
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'word-search-race',
      });

      const clients = [
        await colyseus.connectTo(room, { token: tokenA, roomKey: key }),
      ];
      for (let i = 1; i < 8; i++) {
        clients.push(
          await colyseus.connectTo(room, {
            token: wordSearchRaceCreds(`user-${i}`, roomId).token,
            roomKey: key,
          }),
        );
      }

      const spectator = await colyseus.connectTo(room, {
        token: wordSearchRaceCreds('user-spectator', roomId).token,
        roomKey: key,
      });

      const initMessages: unknown[] = [];
      spectator.onMessage('init', (msg) => initMessages.push(msg));
      await room.waitForNextPatch();
      expect(initMessages.length).toBeGreaterThan(0);
      expect(initMessages[0]).toHaveProperty('grid');

      const errors: { message: string }[] = [];
      spectator.onMessage('select_error', (msg: { message: string }) =>
        errors.push(msg),
      );
      spectator.send('select', {
        start: { row: 0, col: 0 },
        end: { row: 0, col: 1 },
      });
      await room.waitForNextPatch();
      expect(errors).toEqual([{ message: 'Player not in room' }]);

      for (const c of clients) c.leave();
      spectator.leave();
    }, 30000);

    it('rejects a malformed select payload instead of throwing inside the engine', async () => {
      const { key, token } = wordSearchRaceCreds('user-a', 'ROOM13c');
      const room = await colyseus.createRoom('match', {
        roomKey: key,
        game: 'word-search-race',
      });
      const client = await colyseus.connectTo(room, { token, roomKey: key });
      await room.waitForNextPatch();

      const errors: { message: string }[] = [];
      client.onMessage('select_error', (msg: { message: string }) =>
        errors.push(msg),
      );
      client.send('select', {
        start: { row: 'a', col: 0 },
        end: { row: 0, col: 1 },
      });
      await room.waitForNextPatch();
      expect(errors).toEqual([{ message: 'Invalid selection' }]);

      client.leave();
    });
  });
});
