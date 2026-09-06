import { describe, expect, it } from 'bun:test';
import { RpsEngine } from 'services/activity/rps/RpsEngine';

describe('RpsEngine', () => {
  describe('submitPick', () => {
    it('accepts valid picks (rock, paper, scissors)', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      expect(engine.submitPick('player1', 'rock')).toBe(true);
      expect(engine.submitPick('player2', 'paper')).toBe(true);
    });

    it('rejects invalid picks', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      expect(engine.submitPick('player1', 'invalid')).toBe(false);
      expect(engine.submitPick('player2', 'rock1')).toBe(false);
    });

    it('prevents duplicate submission in the same round', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      expect(engine.submitPick('player1', 'rock')).toBe(true);
      expect(engine.submitPick('player1', 'paper')).toBe(false);
    });

    it('allows resubmission in a new round', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      const roundResult = engine.resolveRound();
      expect(roundResult).toBeDefined();
      expect(engine.submitPick('player1', 'paper')).toBe(true);
    });
  });

  describe('resolveRound', () => {
    it('returns null when not both players have submitted', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      engine.submitPick('player1', 'rock');
      expect(engine.resolveRound()).toBeNull();
    });

    it('determines rock beats scissors', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      const result = engine.resolveRound();
      expect(result?.winner).toBe('player1');
      expect(result?.p1Pick).toBe('rock');
      expect(result?.p2Pick).toBe('scissors');
    });

    it('determines paper beats rock', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      engine.submitPick('player1', 'paper');
      engine.submitPick('player2', 'rock');
      const result = engine.resolveRound();
      expect(result?.winner).toBe('player1');
    });

    it('determines scissors beats paper', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      engine.submitPick('player1', 'scissors');
      engine.submitPick('player2', 'paper');
      const result = engine.resolveRound();
      expect(result?.winner).toBe('player1');
    });

    it('returns null winner for a tie', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'rock');
      const result = engine.resolveRound();
      expect(result?.winner).toBeNull();
      expect(result?.p1Pick).toBe('rock');
      expect(result?.p2Pick).toBe('rock');
    });

    it('clears picks after resolution', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();
      expect(engine.submitPick('player1', 'rock')).toBe(true);
    });
  });

  describe('getRoundState', () => {
    it('returns current round number', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      expect(engine.getRoundState().round).toBe(1);
    });

    it('returns submitted player IDs for picks', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      engine.submitPick('player1', 'rock');
      const state = engine.getRoundState();
      expect(state.submitted).toContain('player1');
      expect(state.submitted).not.toContain('player2');
    });

    it('tracks scores correctly', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();
      const state = engine.getRoundState();
      expect(state.scores.player1).toBe(1);
      expect(state.scores.player2).toBe(0);
    });
  });

  describe('getMatchWinner', () => {
    it('returns null when match is not over', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();
      expect(engine.getMatchWinner()).toBeNull();
    });

    it('determines match winner in best-of-3', () => {
      const engine = new RpsEngine({ bestOf: 3 });

      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();

      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();

      expect(engine.getMatchWinner()).toBe('player1');
    });

    it('returns null while scores are tied', () => {
      const engine = new RpsEngine({ bestOf: 3 });

      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();

      engine.submitPick('player1', 'paper');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();

      expect(engine.getMatchWinner()).toBeNull();
    });

    it('determines match winner when one player reaches majority', () => {
      const engine = new RpsEngine({ bestOf: 3 });

      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();

      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();

      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();

      expect(engine.getMatchWinner()).toBe('player1');
    });
  });

  describe('getRoundHistory', () => {
    it('returns empty history initially', () => {
      const engine = new RpsEngine({ bestOf: 3 });
      expect(engine.getRoundHistory()).toEqual([]);
    });

    it('tracks all resolved rounds', () => {
      const engine = new RpsEngine({ bestOf: 3 });

      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();

      engine.submitPick('player1', 'paper');
      engine.submitPick('player2', 'rock');
      engine.resolveRound();

      const history = engine.getRoundHistory();
      expect(history.length).toBe(2);
      expect(history[0]!.winner).toBe('player1');
      expect(history[1]!.winner).toBe('player1');
    });
  });

  describe('configuration', () => {
    it('uses default best-of-3 when not specified', () => {
      const engine = new RpsEngine({});
      expect(engine.getRoundState().bestOf).toBe(3);
    });

    it('respects custom bestOf setting', () => {
      const engine = new RpsEngine({ bestOf: 5 });
      expect(engine.getRoundState().bestOf).toBe(5);
    });

    it('determines winner based on bestOf value', () => {
      const engine = new RpsEngine({ bestOf: 1 });

      engine.submitPick('player1', 'rock');
      engine.submitPick('player2', 'scissors');
      engine.resolveRound();

      expect(engine.getMatchWinner()).toBe('player1');
    });
  });
});
