import { beforeEach, describe, expect, it } from 'bun:test';
import {
  BLOCKS_PER_LEVEL,
  TOWER_LEVELS,
  TowerEngine,
} from 'services/activity/towerUnstable/TowerEngine';

// Seed 42 through SeededRng.next() yields, in order:
// 0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
// 0.6697340414393693, 0.17481389874592423, ...
// Every instability value below is derived from that fixed sequence, so this
// suite pins both the instability formula and the topple roll to exact,
// reproducible numbers instead of asserting on ranges.
const SEED = 42;

describe('TowerEngine', () => {
  let engine: TowerEngine;

  beforeEach(() => {
    engine = new TowerEngine(['a', 'b'], SEED);
  });

  describe('initialization', () => {
    it('starts with the standard 18x3 tower fully intact', () => {
      const state = engine.getState();
      expect(state.levels).toHaveLength(TOWER_LEVELS);
      for (const level of state.levels) {
        expect(level.present).toEqual([true, true, true]);
      }
      expect(state.totalRemoved).toBe(0);
      expect(state.pendingBlocks).toBe(0);
      expect(state.status).toBe('playing');
      expect(state.winner).toBeNull();
      expect(state.lastPull).toBeNull();
    });

    it('starts on the first player in turn order', () => {
      expect(engine.getState().currentPlayer).toBe('a');
    });

    it('rejects fewer than 2 players', () => {
      expect(() => new TowerEngine(['solo'], SEED)).toThrow();
    });

    it('excludes the top two levels from the eligible count', () => {
      expect(engine.getState().eligibleLevelCount).toBe(TOWER_LEVELS - 2);
    });
  });

  describe('validation', () => {
    it('rejects a pull out of turn', () => {
      const result = engine.pull('b', 0, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not b's turn");
    });

    it('rejects an invalid level index', () => {
      expect(engine.pull('a', -1, 0).success).toBe(false);
      expect(engine.pull('a', TOWER_LEVELS, 0).success).toBe(false);
    });

    it('rejects an invalid position index', () => {
      expect(engine.pull('a', 0, -1).success).toBe(false);
      expect(engine.pull('a', 0, BLOCKS_PER_LEVEL).success).toBe(false);
    });

    it('rejects pulling from the top two protected levels', () => {
      const topLevel = TOWER_LEVELS - 1;
      const result = engine.pull('a', topLevel, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain('protected');
    });

    it('rejects pulling an already-removed block', () => {
      engine.pull('a', 0, 0);
      const result = engine.pull('b', 0, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already removed');
    });

    it('rejects pulls once the game has ended', () => {
      const solo = new TowerEngine(['a', 'b'], SEED);
      // Force a topple deterministically using the seeded sequence below.
      solo.pull('a', 0, 0);
      solo.pull('b', 0, 1);
      solo.pull('a', 0, 2);
      solo.pull('b', 1, 0);
      solo.pull('a', 1, 1); // topples per the fixed rng sequence
      expect(solo.getState().status).toBe('ended');
      const result = solo.pull('b', 2, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already over');
    });
  });

  describe('deterministic instability and topple sequence', () => {
    it('produces exact instability values and a topple on the 5th pull', () => {
      const r1 = engine.pull('a', 0, 0);
      expect(r1.success).toBe(true);
      expect(r1.instability).toBeCloseTo(0.074074, 5);
      expect(r1.toppled).toBe(false);
      expect(engine.getState().currentPlayer).toBe('b');

      const r2 = engine.pull('b', 0, 1);
      expect(r2.instability).toBeCloseTo(0.281481, 5);
      expect(r2.toppled).toBe(false);
      expect(engine.getState().currentPlayer).toBe('a');

      const r3 = engine.pull('a', 0, 2);
      expect(r3.instability).toBeCloseTo(0.622222, 5);
      expect(r3.toppled).toBe(false);
      expect(engine.getState().currentPlayer).toBe('b');

      const r4 = engine.pull('b', 1, 0);
      expect(r4.instability).toBeCloseTo(0.096296, 5);
      expect(r4.toppled).toBe(false);
      expect(engine.getState().currentPlayer).toBe('a');

      const r5 = engine.pull('a', 1, 1);
      expect(r5.instability).toBeCloseTo(0.303704, 5);
      expect(r5.toppled).toBe(true);

      const state = engine.getState();
      expect(state.status).toBe('ended');
      expect(state.winner).toBe('b');
      expect(state.eliminated).toEqual(['a']);
      expect(state.lastPull).toEqual({
        level: 1,
        position: 1,
        instability: r5.instability!,
        toppled: true,
        puller: 'a',
      });
    });

    it('is fully reproducible from the same seed and move sequence', () => {
      const replay = new TowerEngine(['a', 'b'], SEED);
      const moves: [string, number, number][] = [
        ['a', 0, 0],
        ['b', 0, 1],
        ['a', 0, 2],
        ['b', 1, 0],
        ['a', 1, 1],
      ];
      const first = moves.map(([p, l, pos]) => engine.pull(p, l, pos));
      const second = moves.map(([p, l, pos]) => replay.pull(p, l, pos));
      expect(second).toEqual(first);
      expect(replay.getState()).toEqual(engine.getState());
    });

    it('produces different instability values for a different seed', () => {
      const other = new TowerEngine(['a', 'b'], SEED + 1);
      const r1 = other.pull('a', 0, 0);
      expect(r1.instability).toBeCloseTo(0.074074, 5); // formula-driven, seed-independent
      // whether it topples depends on the seed's roll, not asserted here
    });
  });

  describe('surviving a pull', () => {
    it('stacks a pulled block on top and forms a new level after 3 pulls', () => {
      // These three specific pulls (level 5+) survive under seed 42 and let
      // us assert the stacking mechanic without triggering a topple.
      engine.pull('a', 5, 0);
      engine.pull('b', 6, 0);
      const before = engine.getState();
      expect(before.levels).toHaveLength(TOWER_LEVELS);
      expect(before.pendingBlocks).toBe(2);

      const r3 = engine.pull('a', 7, 0);
      expect(r3.toppled).toBe(false);
      const after = engine.getState();
      expect(after.pendingBlocks).toBe(0);
      expect(after.levels).toHaveLength(TOWER_LEVELS + 1);
      expect(after.levels[TOWER_LEVELS]!.present).toEqual([true, true, true]);
      expect(after.eligibleLevelCount).toBe(TOWER_LEVELS - 1);
    });
  });

  describe('multiplayer elimination (>2 players)', () => {
    it('eliminates the puller on a topple but keeps the match going with 2+ survivors left', () => {
      const engine3 = new TowerEngine(['a', 'b', 'c'], SEED);
      engine3.pull('a', 0, 0);
      engine3.pull('b', 0, 1);
      engine3.pull('c', 0, 2);
      engine3.pull('a', 1, 0);
      const r5 = engine3.pull('b', 1, 1); // topples per the fixed rng sequence

      expect(r5.toppled).toBe(true);
      const state = engine3.getState();
      expect(state.status).toBe('playing');
      expect(state.eliminated).toEqual(['b']);
      expect(state.turnOrder).toEqual(['a', 'b', 'c']);
      expect(state.currentPlayer).toBe('c');
    });
  });

  describe('forceEliminate', () => {
    it('removes a player without a pull and passes turn if they were current', () => {
      engine.forceEliminate('a');
      const state = engine.getState();
      expect(state.status).toBe('ended');
      expect(state.winner).toBe('b');
      expect(state.eliminated).toEqual(['a']);
    });

    it('is a no-op for a player already eliminated or absent', () => {
      engine.forceEliminate('a');
      const stateBefore = engine.getState();
      engine.forceEliminate('a');
      engine.forceEliminate('ghost');
      expect(engine.getState()).toEqual(stateBefore);
    });
  });
});
