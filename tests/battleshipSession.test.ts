import { describe, expect, it } from 'bun:test';
import type { ShipPlacement } from 'services/activity/battleship/BattleshipEngine';
import {
  BattleshipSession,
  type BattleshipSessionIdentity,
} from 'services/activity/battleship/BattleshipSession';
import type { ActivityMode } from 'services/activity/gameId';
import type { GamificationService } from 'services/gamification';

function identity(mode: ActivityMode = 'multi'): BattleshipSessionIdentity {
  return {
    sessionKey: `inst-1:battleship:${mode}`,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode,
  };
}

function fakeBroadcaster() {
  const perPlayer: { userId: string; type: string; payload: any }[] = [];
  const publicMessages: { type: string; payload: any }[] = [];
  return {
    sendToPlayer: (
      userId: string,
      message: { type: string; payload?: unknown },
    ) => {
      perPlayer.push({ userId, type: message.type, payload: message.payload });
    },
    broadcastPublic: (message: { type: string; payload?: unknown }) => {
      publicMessages.push({ type: message.type, payload: message.payload });
    },
    perPlayer,
    publicMessages,
    lastStateFor(userId: string) {
      const messages = perPlayer.filter(
        (m) => m.userId === userId && m.type === 'state',
      );
      return messages[messages.length - 1]?.payload;
    },
  };
}

const FLEET_A: ShipPlacement[] = [
  { type: 'carrier', x: 0, y: 0, orientation: 'horizontal' },
  { type: 'battleship', x: 0, y: 1, orientation: 'horizontal' },
  { type: 'cruiser', x: 0, y: 2, orientation: 'horizontal' },
  { type: 'submarine', x: 0, y: 3, orientation: 'horizontal' },
  { type: 'destroyer', x: 0, y: 4, orientation: 'horizontal' },
];

const FLEET_B: ShipPlacement[] = [
  { type: 'carrier', x: 5, y: 0, orientation: 'vertical' },
  { type: 'battleship', x: 6, y: 0, orientation: 'vertical' },
  { type: 'cruiser', x: 7, y: 0, orientation: 'vertical' },
  { type: 'submarine', x: 8, y: 0, orientation: 'vertical' },
  { type: 'destroyer', x: 9, y: 0, orientation: 'vertical' },
];

function placedSession() {
  const broadcaster = fakeBroadcaster();
  const session = new BattleshipSession(identity(), broadcaster);
  session.addPlayer('user-a', 'conn-a');
  session.addPlayer('user-b', 'conn-b');
  session.placeShips('user-a', FLEET_A);
  session.placeShips('user-b', FLEET_B);
  return { broadcaster, session };
}

// Drives a full placement+fire sequence to a win for user-a (p1): fires at
// every cell of FLEET_B (17 cells total across all 5 ships) while user-b
// fires harmless misses into open water (y=5/6, outside FLEET_A's y=0..4
// footprint) on the alternating turns in between, so p1's fleet is never at
// risk of being fully sunk first.
function playToVictory(session: BattleshipSession) {
  const aShots: [number, number][] = [
    [5, 0],
    [5, 1],
    [5, 2],
    [5, 3],
    [5, 4],
    [6, 0],
    [6, 1],
    [6, 2],
    [6, 3],
    [7, 0],
    [7, 1],
    [7, 2],
    [8, 0],
    [8, 1],
    [8, 2],
    [9, 0],
    [9, 1],
  ];
  const bMisses: [number, number][] = [];
  for (let x = 0; x < 10; x++) bMisses.push([x, 5]);
  for (let x = 0; x < 6; x++) bMisses.push([x, 6]);

  aShots.forEach(([x, y], i) => {
    session.fire('user-a', x, y);
    const miss = bMisses[i];
    if (miss) session.fire('user-b', miss[0], miss[1]);
  });
}

describe('BattleshipSession', () => {
  it('assigns p1 to the first joiner and p2 to the second', () => {
    const broadcaster = fakeBroadcaster();
    const session = new BattleshipSession(identity(), broadcaster);
    expect(session.addPlayer('user-a', 'conn-a')).toBe('p1');
    expect(session.addPlayer('user-b', 'conn-b')).toBe('p2');
  });

  it('rejects a third player', () => {
    const broadcaster = fakeBroadcaster();
    const session = new BattleshipSession(identity(), broadcaster);
    session.addPlayer('user-a', 'conn-a');
    session.addPlayer('user-b', 'conn-b');
    expect(session.addPlayer('user-c', 'conn-c')).toBeNull();
  });

  it('sends each player only their own masked state, never the same payload', () => {
    const { broadcaster } = placedSession();

    const viewA = broadcaster.lastStateFor('user-a');
    const viewB = broadcaster.lastStateFor('user-b');

    expect(viewA.phase).toBe('battle');
    expect(viewA.own.ships).toHaveLength(5);
    expect(viewA.opponent.ships).toHaveLength(0);
    expect(viewB.own.ships).toHaveLength(5);
    expect(viewB.opponent.ships).toHaveLength(0);
  });

  it('never includes an unsunk opponent ship in either players masked view after shots', () => {
    const { broadcaster, session } = placedSession();
    session.fire('user-a', 0, 0); // miss on p2 board (p2 ships start at x=5)
    session.fire('user-b', 0, 0); // hits p1 carrier, not sunk

    const viewA = broadcaster.lastStateFor('user-a');
    const viewB = broadcaster.lastStateFor('user-b');
    expect(viewA.opponent.ships).toHaveLength(0);
    expect(viewB.opponent.ships).toHaveLength(0);
  });

  it('relays a placement validation error only to the sender', () => {
    const broadcaster = fakeBroadcaster();
    const session = new BattleshipSession(identity(), broadcaster);
    session.addPlayer('user-a', 'conn-a');
    session.addPlayer('user-b', 'conn-b');

    const badFleet = FLEET_A.slice(0, 4);
    session.placeShips('user-a', badFleet);

    const errors = broadcaster.perPlayer.filter(
      (m) => m.type === 'placement_error',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]!.userId).toBe('user-a');
  });

  it('relays a fire validation error (out of turn) only to the sender', () => {
    const { broadcaster, session } = placedSession();
    session.fire('user-b', 0, 0); // p2 fires out of turn, p1 goes first

    const errors = broadcaster.perPlayer.filter((m) => m.type === 'fire_error');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.userId).toBe('user-b');
  });

  it('rejects firing at an already-fired-upon coordinate', () => {
    const { broadcaster, session } = placedSession();
    session.fire('user-a', 5, 0);
    session.fire('user-b', 0, 0);
    session.fire('user-a', 5, 0);

    const errors = broadcaster.perPlayer.filter((m) => m.type === 'fire_error');
    expect(errors).toHaveLength(1);
  });

  it('rejects placement messages once battle has begun', () => {
    const { broadcaster, session } = placedSession();
    session.placeShips('user-a', FLEET_A);

    const errors = broadcaster.perPlayer.filter(
      (m) => m.type === 'placement_error',
    );
    expect(errors).toHaveLength(1);
  });

  it('reveals a ship to the opponent only once it is fully sunk', () => {
    const { broadcaster, session } = placedSession();
    session.fire('user-a', 9, 0); // hits p2 destroyer, not sunk
    session.fire('user-b', 0, 0);
    session.fire('user-a', 9, 1); // sinks p2 destroyer

    const viewA = broadcaster.lastStateFor('user-a');
    expect(viewA.opponent.ships).toHaveLength(1);
    expect(viewA.opponent.ships[0].type).toBe('destroyer');
  });

  it('records a game result exactly once when a winner emerges via forfeit', () => {
    const broadcaster = fakeBroadcaster();
    const recorded: unknown[] = [];
    const fakeGamification = {
      recordGameResult: (input: unknown) => recorded.push(input),
    } as unknown as GamificationService;

    const session = new BattleshipSession(
      identity(),
      broadcaster,
      fakeGamification,
    );
    session.addPlayer('user-a', 'conn-a');
    session.addPlayer('user-b', 'conn-b');
    session.placeShips('user-a', FLEET_A);
    session.placeShips('user-b', FLEET_B);

    session.leave('user-b', 'conn-b');

    expect(recorded).toEqual([
      {
        sessionId: 'inst-1',
        guildId: 'guild-1',
        gameType: 'battleship',
        results: [
          { userId: 'user-a', position: 1 },
          { userId: 'user-b', position: 2 },
        ],
      },
    ]);
  });

  it('holds a disconnected multi-mode player open for reconnect, without forfeiting immediately', () => {
    const { broadcaster, session } = placedSession();
    session.pauseForDisconnect('user-a', 'conn-a');

    const disconnectMsg = broadcaster.publicMessages.find(
      (m) => m.type === 'opponent_disconnected',
    );
    expect(disconnectMsg).toBeTruthy();
  });

  it('reveals full boards to both players once the game ends', () => {
    const { broadcaster, session } = placedSession();
    session.leave('user-b', 'conn-b');

    const viewA = broadcaster.lastStateFor('user-a');
    expect(viewA.phase).toBe('ended');
    expect(viewA.opponent.ships).toHaveLength(5);
  });

  describe('getWinnerUserId', () => {
    it('returns null before a winner exists', () => {
      const { session } = placedSession();
      expect(session.getWinnerUserId()).toBe(null);
    });

    it('resolves the winning side back to the winning userId', () => {
      const { session } = placedSession();
      playToVictory(session);
      expect(session.getWinnerUserId()).toBe('user-a');
    });
  });

  describe('spectators', () => {
    it('sends a spectator an initial masked state on join, with neither fleet revealed', () => {
      const { broadcaster, session } = placedSession();
      session.addSpectator('user-c', 'conn-c');

      const viewC = broadcaster.lastStateFor('user-c');
      expect(viewC).toBeTruthy();
      expect(viewC.phase).toBe('battle');
      expect(viewC.p1.ships).toHaveLength(0);
      expect(viewC.p2.ships).toHaveLength(0);
    });

    it('sends a spectator an updated masked state on the next move, without leaking an unsunk ship', () => {
      const { broadcaster, session } = placedSession();
      session.addSpectator('user-c', 'conn-c');
      const messagesBefore = broadcaster.perPlayer.filter(
        (m) => m.userId === 'user-c' && m.type === 'state',
      ).length;

      session.fire('user-a', 5, 0); // hits p2's carrier, not sunk (carrier is 5 cells)

      const messagesAfter = broadcaster.perPlayer.filter(
        (m) => m.userId === 'user-c' && m.type === 'state',
      ).length;
      expect(messagesAfter).toBeGreaterThan(messagesBefore);
      const viewC = broadcaster.lastStateFor('user-c');
      expect(viewC.p2.ships).toHaveLength(0);
      expect(viewC.p2.shots).toContainEqual(
        expect.objectContaining({ x: 5, y: 0, hit: true }),
      );
    });

    it('reveals a ship to a spectator only once it is fully sunk, same as a player', () => {
      const { broadcaster, session } = placedSession();
      session.addSpectator('user-c', 'conn-c');
      // Destroyer (2 cells) at x=9,y=0 / x=9,y=1 (FLEET_B, vertical). Turns
      // alternate, so user-b gets a harmless miss (y=5 is outside FLEET_A's
      // y=0..4 footprint) between user-a's two shots.
      session.fire('user-a', 9, 0);
      session.fire('user-b', 0, 5);
      session.fire('user-a', 9, 1);

      const viewC = broadcaster.lastStateFor('user-c');
      const destroyer = viewC.p2.ships.find(
        (s: { type: string }) => s.type === 'destroyer',
      );
      expect(destroyer).toBeTruthy();
      expect(destroyer.sunk).toBe(true);
    });

    it('stops sending state to a spectator once they leave', () => {
      const { broadcaster, session } = placedSession();
      session.addSpectator('user-c', 'conn-c');
      session.leave('user-c', 'conn-c');
      const messagesAtLeave = broadcaster.perPlayer.filter(
        (m) => m.userId === 'user-c' && m.type === 'state',
      ).length;

      session.fire('user-a', 5, 0);

      const messagesAfter = broadcaster.perPlayer.filter(
        (m) => m.userId === 'user-c' && m.type === 'state',
      ).length;
      expect(messagesAfter).toBe(messagesAtLeave);
    });
  });

  describe('substitutePlayer', () => {
    it('reseats the incoming player and resets the engine for a fresh match', () => {
      const { session } = placedSession();
      playToVictory(session);
      const ok = session.substitutePlayer('user-b', 'user-new', {});
      expect(ok).toBe(true);
      expect(session.getWinnerUserId()).toBe(null); // engine reset, no winner yet
    });
  });
});
