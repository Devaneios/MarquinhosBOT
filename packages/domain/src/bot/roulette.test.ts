import { describe, expect, it } from 'bun:test';
import {
  applyRouletteAction,
  createRouletteChambers,
  getRouletteBulletCount,
  getRouletteScores,
  getRouletteRewardBonuses,
  type RouletteState,
} from './roulette';

const createState = (overrides: Partial<RouletteState> = {}): RouletteState => ({
  chambers: [false, true, false, false, false, false],
  currentChamber: 0,
  totalChambers: 6,
  bullets: 1,
  survived: 0,
  gameOver: false,
  result: null,
  players: [
    { userId: 'one', username: 'One', alive: true, survived: 0 },
    { userId: 'two', username: 'Two', alive: true, survived: 0 },
  ],
  currentPlayerIndex: 0,
  mode: 'multiplayer',
  ...overrides,
});

describe('Russian roulette rules', () => {
  it('uses one or two bullets and places them in the selected chambers', () => {
    expect(getRouletteBulletCount(0)).toBe(1);
    expect(getRouletteBulletCount(0.99)).toBe(2);
    expect(createRouletteChambers(4, [1, 3])).toEqual([false, true, false, true]);
  });

  it('rejects actions from the wrong multiplayer player', () => {
    const result = applyRouletteAction(createState(), 'two', { type: 'pull_trigger' });

    expect(result.error).toBe('not-your-turn');
    expect(result.state.currentChamber).toBe(0);
  });

  it('advances after an empty chamber and awards survival points', () => {
    const result = applyRouletteAction(createState(), 'one', { type: 'pull_trigger' });

    expect(result.state.currentChamber).toBe(1);
    expect(result.state.players[0]?.survived).toBe(1);
    expect(result.state.currentPlayerIndex).toBe(1);
    expect(getRouletteScores(result.state)).toEqual({ one: 65, two: 50 });
  });

  it('ends on a bullet and calculates winner and loser reward bonuses', () => {
    const state = createState({ currentChamber: 1 });
    const result = applyRouletteAction(state, 'one', { type: 'pull_trigger' });

    expect(result.state.gameOver).toBe(true);
    expect(result.state.players[0]?.alive).toBe(false);
    expect(getRouletteRewardBonuses(result.state)).toEqual({
      one: { rank: 2, xpBonus: 0, won: false },
      two: { rank: 1, xpBonus: 40, won: true },
    });
  });

  it('charges a solo survival and resets the chamber when spinning', () => {
    const state = createState({
      mode: 'solo',
      players: [{ userId: 'one', username: 'One', alive: true, survived: 2 }],
      survived: 2,
      currentChamber: 3,
    });
    const result = applyRouletteAction(state, 'one', { type: 'spin_chamber' }, [true, false, false, false, false, false]);

    expect(result.state.survived).toBe(1);
    expect(result.state.currentChamber).toBe(0);
    expect(result.state.chambers[0]).toBe(true);
    expect(getRouletteScores(result.state)).toEqual({ one: 10 });
  });
});
