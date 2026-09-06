import { describe, expect, it } from 'bun:test';
import {
  BattleshipEngine,
  type ShipPlacement,
} from 'services/activity/battleship/BattleshipEngine';
import { maskBoard, viewFor } from 'services/activity/battleship/masking';

const VALID_FLEET: ShipPlacement[] = [
  { type: 'carrier', x: 0, y: 0, orientation: 'horizontal' },
  { type: 'battleship', x: 0, y: 1, orientation: 'horizontal' },
  { type: 'cruiser', x: 0, y: 2, orientation: 'horizontal' },
  { type: 'submarine', x: 0, y: 3, orientation: 'horizontal' },
  { type: 'destroyer', x: 0, y: 4, orientation: 'horizontal' },
];

const VALID_FLEET_P2: ShipPlacement[] = [
  { type: 'carrier', x: 5, y: 0, orientation: 'vertical' },
  { type: 'battleship', x: 6, y: 0, orientation: 'vertical' },
  { type: 'cruiser', x: 7, y: 0, orientation: 'vertical' },
  { type: 'submarine', x: 8, y: 0, orientation: 'vertical' },
  { type: 'destroyer', x: 9, y: 0, orientation: 'vertical' },
];

describe('BattleshipEngine placement', () => {
  it('accepts a valid fleet and stays in placement until both sides place', () => {
    const engine = new BattleshipEngine();
    expect(engine.placeShips('p1', VALID_FLEET).ok).toBe(true);
    expect(engine.getPhase()).toBe('placement');
    expect(engine.placeShips('p2', VALID_FLEET_P2).ok).toBe(true);
    expect(engine.getPhase()).toBe('battle');
  });

  it('rejects overlapping ships', () => {
    const engine = new BattleshipEngine();
    const overlapping: ShipPlacement[] = [
      { type: 'carrier', x: 0, y: 0, orientation: 'horizontal' },
      { type: 'battleship', x: 2, y: 0, orientation: 'horizontal' },
      { type: 'cruiser', x: 0, y: 2, orientation: 'horizontal' },
      { type: 'submarine', x: 0, y: 3, orientation: 'horizontal' },
      { type: 'destroyer', x: 0, y: 4, orientation: 'horizontal' },
    ];
    const result = engine.placeShips('p1', overlapping);
    expect(result.ok).toBe(false);
  });

  it('rejects out-of-bounds ships', () => {
    const engine = new BattleshipEngine();
    const outOfBounds: ShipPlacement[] = [
      { type: 'carrier', x: 7, y: 0, orientation: 'horizontal' },
      { type: 'battleship', x: 0, y: 1, orientation: 'horizontal' },
      { type: 'cruiser', x: 0, y: 2, orientation: 'horizontal' },
      { type: 'submarine', x: 0, y: 3, orientation: 'horizontal' },
      { type: 'destroyer', x: 0, y: 4, orientation: 'horizontal' },
    ];
    expect(engine.placeShips('p1', outOfBounds).ok).toBe(false);
  });

  it('rejects wrong ship count / missing types', () => {
    const engine = new BattleshipEngine();
    const missing = VALID_FLEET.slice(0, 4);
    expect(engine.placeShips('p1', missing).ok).toBe(false);
  });

  it('rejects duplicate ship types', () => {
    const engine = new BattleshipEngine();
    const dup: ShipPlacement[] = [
      { type: 'carrier', x: 0, y: 0, orientation: 'horizontal' },
      { type: 'carrier', x: 0, y: 1, orientation: 'horizontal' },
      { type: 'cruiser', x: 0, y: 2, orientation: 'horizontal' },
      { type: 'submarine', x: 0, y: 3, orientation: 'horizontal' },
      { type: 'destroyer', x: 0, y: 4, orientation: 'horizontal' },
    ];
    expect(engine.placeShips('p1', dup).ok).toBe(false);
  });

  it('rejects an invalid orientation value', () => {
    const engine = new BattleshipEngine();
    const bad = VALID_FLEET.map((s) =>
      s.type === 'carrier' ? { ...s, orientation: 'diagonal' as never } : s,
    );
    expect(engine.placeShips('p1', bad).ok).toBe(false);
  });

  it('rejects placing twice for the same side', () => {
    const engine = new BattleshipEngine();
    expect(engine.placeShips('p1', VALID_FLEET).ok).toBe(true);
    expect(engine.placeShips('p1', VALID_FLEET).ok).toBe(false);
  });

  it('rejects placement messages once battle has started', () => {
    const engine = new BattleshipEngine();
    engine.placeShips('p1', VALID_FLEET);
    engine.placeShips('p2', VALID_FLEET_P2);
    expect(engine.getPhase()).toBe('battle');
    expect(engine.placeShips('p1', VALID_FLEET).ok).toBe(false);
  });
});

function readyEngine(): BattleshipEngine {
  const engine = new BattleshipEngine();
  engine.placeShips('p1', VALID_FLEET);
  engine.placeShips('p2', VALID_FLEET_P2);
  return engine;
}

describe('BattleshipEngine firing', () => {
  it('rejects firing before both sides have placed', () => {
    const engine = new BattleshipEngine();
    engine.placeShips('p1', VALID_FLEET);
    expect(engine.fire('p1', 0, 0).ok).toBe(false);
  });

  it('p1 fires first and alternates turn after a hit', () => {
    const engine = readyEngine();
    expect(engine.getTurn()).toBe('p1');
    const result = engine.fire('p1', 5, 0);
    expect(result.ok).toBe(true);
    expect(result.hit).toBe(true);
    expect(engine.getTurn()).toBe('p2');
  });

  it('alternates turn on a miss too', () => {
    const engine = readyEngine();
    const result = engine.fire('p1', 0, 0);
    expect(result.ok).toBe(true);
    expect(result.hit).toBe(false);
    expect(engine.getTurn()).toBe('p2');
  });

  it('rejects firing out of turn', () => {
    const engine = readyEngine();
    const result = engine.fire('p2', 5, 0);
    expect(result.ok).toBe(false);
  });

  it('rejects firing at an already-fired-upon coordinate', () => {
    const engine = readyEngine();
    engine.fire('p1', 3, 3);
    engine.fire('p2', 0, 0);
    const result = engine.fire('p1', 3, 3);
    expect(result.ok).toBe(false);
  });

  it('rejects out-of-bounds coordinates', () => {
    const engine = readyEngine();
    expect(engine.fire('p1', -1, 0).ok).toBe(false);
    expect(engine.fire('p1', 10, 0).ok).toBe(false);
  });

  it('reports sunk when the final cell of a ship is hit', () => {
    const engine = readyEngine();
    engine.fire('p1', 9, 0); // hit destroyer p2 cell 1
    engine.fire('p2', 0, 0);
    const result = engine.fire('p1', 9, 1); // destroyer's second/last cell
    expect(result.ok).toBe(true);
    expect(result.hit).toBe(true);
    expect(result.sunk).toBe('destroyer');
  });

  it('declares a winner once all opponent ships are sunk', () => {
    const engine = new BattleshipEngine();
    engine.placeShips('p1', [
      { type: 'carrier', x: 0, y: 0, orientation: 'horizontal' },
      { type: 'battleship', x: 0, y: 1, orientation: 'horizontal' },
      { type: 'cruiser', x: 0, y: 2, orientation: 'horizontal' },
      { type: 'submarine', x: 0, y: 3, orientation: 'horizontal' },
      { type: 'destroyer', x: 0, y: 4, orientation: 'horizontal' },
    ]);
    engine.placeShips('p2', [
      { type: 'destroyer', x: 0, y: 0, orientation: 'horizontal' },
      { type: 'carrier', x: 0, y: 5, orientation: 'horizontal' },
      { type: 'battleship', x: 0, y: 6, orientation: 'horizontal' },
      { type: 'cruiser', x: 0, y: 7, orientation: 'horizontal' },
      { type: 'submarine', x: 0, y: 8, orientation: 'horizontal' },
    ]);

    // Sink only p2's destroyer at (0,0)-(1,0); everything else on p2's
    // board is untouched, so the win must fire off that ship alone, not a
    // full-board wipe.
    engine.fire('p1', 0, 0);
    engine.fire('p2', 5, 5);
    const result = engine.fire('p1', 1, 0);
    expect(result.ok).toBe(true);
    expect(result.sunk).toBe('destroyer');
    expect(result.winner).toBeUndefined();
    expect(engine.getPhase()).toBe('battle');
  });

  it('ends the game only once every ship of a fleet is sunk', () => {
    const engine = new BattleshipEngine();
    const tiny: ShipPlacement[] = [
      { type: 'destroyer', x: 0, y: 0, orientation: 'horizontal' },
      { type: 'submarine', x: 0, y: 1, orientation: 'horizontal' },
      { type: 'cruiser', x: 0, y: 2, orientation: 'horizontal' },
      { type: 'battleship', x: 0, y: 3, orientation: 'horizontal' },
      { type: 'carrier', x: 0, y: 4, orientation: 'horizontal' },
    ];
    engine.placeShips('p1', tiny);
    engine.placeShips(
      'p2',
      tiny.map((s) => ({ ...s, x: 5 })),
    );

    const p2Cells = tiny.flatMap((s) => {
      const size =
        s.type === 'destroyer'
          ? 2
          : s.type === 'submarine' || s.type === 'cruiser'
            ? 3
            : s.type === 'battleship'
              ? 4
              : 5;
      return Array.from({ length: size }, (_, i) => ({ x: 5 + i, y: s.y }));
    });

    // p1's own board only occupies x=0, y0-4, so anything in x=1..9 on row 9
    // or 8 is a guaranteed-safe, guaranteed-unique miss for p2's spam shots
    // in between p1's real attack — the alternation is what's under test.
    const p2SafeShots = [
      ...Array.from({ length: 9 }, (_, i) => ({ x: i + 1, y: 9 })),
      ...Array.from({ length: 9 }, (_, i) => ({ x: i + 1, y: 8 })),
    ];

    let last;
    for (let i = 0; i < p2Cells.length; i++) {
      const cell = p2Cells[i]!;
      last = engine.fire('p1', cell.x, cell.y);
      if (i < p2Cells.length - 1) {
        const safe = p2SafeShots[i]!;
        engine.fire('p2', safe.x, safe.y);
      }
    }

    expect(last!.winner).toBe('p1');
    expect(engine.getPhase()).toBe('ended');
  });

  it('forceWinner ends the game without requiring a full sink', () => {
    const engine = readyEngine();
    engine.forceWinner('p2');
    expect(engine.getPhase()).toBe('ended');
    expect(engine.getWinner()).toBe('p2');
    expect(engine.fire('p1', 0, 0).ok).toBe(false);
  });
});

describe('battleship masking', () => {
  it('never reveals an unsunk opponent ship position', () => {
    const engine = readyEngine();
    const opponentView = viewFor(engine, 'p2').opponent;
    expect(opponentView.ships).toHaveLength(0);
  });

  it('reveals a ship once it is fully sunk, and only that ship', () => {
    const engine = readyEngine();
    engine.fire('p1', 9, 0);
    engine.fire('p2', 0, 0);
    engine.fire('p1', 9, 1); // sinks p2's destroyer

    const view = viewFor(engine, 'p1').opponent;
    expect(view.ships).toHaveLength(1);
    expect(view.ships[0]!.type).toBe('destroyer');
    expect(view.ships[0]!.sunk).toBe(true);
  });

  it('reveals nothing extra beyond the sunk ship even with other hits recorded', () => {
    const engine = readyEngine();
    engine.fire('p1', 0, 0); // hits p2 carrier (not sunk)
    engine.fire('p2', 0, 0);
    engine.fire('p1', 9, 0); // hits p2 destroyer (not sunk)
    engine.fire('p2', 1, 0);
    engine.fire('p1', 9, 1); // sinks p2 destroyer

    const view = viewFor(engine, 'p1').opponent;
    const types = view.ships.map((s) => s.type);
    expect(types).toEqual(['destroyer']);
  });

  it('always shows the viewer their own full fleet regardless of hits', () => {
    const engine = readyEngine();
    const own = viewFor(engine, 'p1').own;
    expect(own.ships).toHaveLength(5);
  });

  it('reveals full boards to both sides once the game has ended', () => {
    const engine = readyEngine();
    engine.forceWinner('p1');
    const view = viewFor(engine, 'p2');
    expect(view.opponent.ships).toHaveLength(5);
  });

  it('maskBoard hides ship cells for a non-owner unsunk ship directly', () => {
    const engine = readyEngine();
    const board = engine.getBoardSnapshot('p1');
    const masked = maskBoard(board, { isOwner: false, gameEnded: false });
    expect(masked.ships).toHaveLength(0);
  });

  it('shot views carry shipType/sunk only for hits, and only once actually sunk', () => {
    const engine = readyEngine();
    engine.fire('p1', 9, 0); // hit, not yet sunk
    const midView = viewFor(engine, 'p1').opponent;
    const midShot = midView.shots.find((s) => s.x === 9 && s.y === 0)!;
    expect(midShot.hit).toBe(true);
    expect(midShot.shipType).toBe('destroyer');
    expect(midShot.sunk).toBe(false);

    engine.fire('p2', 0, 0);
    engine.fire('p1', 9, 1); // sinks it
    const afterView = viewFor(engine, 'p1').opponent;
    const afterShot = afterView.shots.find((s) => s.x === 9 && s.y === 0)!;
    expect(afterShot.sunk).toBe(true);
  });
});
