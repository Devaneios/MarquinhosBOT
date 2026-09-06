import { beforeEach, describe, expect, it } from 'bun:test';
import { TicTacToeEngine } from 'services/activity/ticTacToe/TicTacToeEngine';

describe('TicTacToeEngine', () => {
  let engine: TicTacToeEngine;

  beforeEach(() => {
    engine = new TicTacToeEngine();
  });

  describe('initialization', () => {
    it('starts with empty 3x3 board', () => {
      const state = engine.getState();
      expect(state.board).toEqual([
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ]);
    });

    it('has no winner at start', () => {
      const state = engine.getState();
      expect(state.winner).toBe(null);
    });

    it('has no draw at start', () => {
      const state = engine.getState();
      expect(state.isDraw).toBe(false);
    });

    it('starts with X as current player', () => {
      const state = engine.getState();
      expect(state.currentPlayer).toBe('X');
    });

    it('has empty moves list', () => {
      const state = engine.getState();
      expect(state.moveCount).toBe(0);
    });
  });

  describe('move validation and placement', () => {
    it('places X at (0,0)', () => {
      const result = engine.makeMove(0, 0, 'X');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.board[0]![0]).toBe('X');
    });

    it('switches to O after X plays', () => {
      engine.makeMove(0, 0, 'X');
      const state = engine.getState();
      expect(state.currentPlayer).toBe('O');
    });

    it('rejects move on occupied cell', () => {
      engine.makeMove(0, 0, 'X');
      const result = engine.makeMove(0, 0, 'O');
      expect(result.success).toBe(false);
      expect(result.error).toContain('occupied');
    });

    it('rejects move by wrong player', () => {
      engine.makeMove(0, 0, 'X');
      const result = engine.makeMove(0, 1, 'X');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not X');
    });

    it('rejects move with invalid coordinates', () => {
      let result = engine.makeMove(-1, 0, 'X');
      expect(result.success).toBe(false);
      result = engine.makeMove(3, 0, 'X');
      expect(result.success).toBe(false);
      result = engine.makeMove(0, 3, 'X');
      expect(result.success).toBe(false);
    });

    it('increments move count on valid move', () => {
      engine.makeMove(0, 0, 'X');
      let state = engine.getState();
      expect(state.moveCount).toBe(1);
      engine.makeMove(0, 1, 'O');
      state = engine.getState();
      expect(state.moveCount).toBe(2);
    });
  });

  describe('row wins', () => {
    it('detects top row win for X', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(1, 0, 'O');
      engine.makeMove(0, 1, 'X');
      engine.makeMove(1, 1, 'O');
      const result = engine.makeMove(0, 2, 'X');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.winner).toBe('X');
    });

    it('detects middle row win for O', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(1, 0, 'O');
      engine.makeMove(0, 1, 'X');
      engine.makeMove(1, 1, 'O');
      engine.makeMove(2, 2, 'X');
      const result = engine.makeMove(1, 2, 'O');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.winner).toBe('O');
    });

    it('detects bottom row win', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(2, 0, 'O');
      engine.makeMove(0, 1, 'X');
      engine.makeMove(2, 1, 'O');
      engine.makeMove(1, 0, 'X');
      const result = engine.makeMove(2, 2, 'O');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.winner).toBe('O');
    });
  });

  describe('column wins', () => {
    it('detects left column win for X', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(0, 1, 'O');
      engine.makeMove(1, 0, 'X');
      engine.makeMove(1, 1, 'O');
      const result = engine.makeMove(2, 0, 'X');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.winner).toBe('X');
    });

    it('detects middle column win for O', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(0, 1, 'O');
      engine.makeMove(0, 2, 'X');
      engine.makeMove(1, 1, 'O');
      engine.makeMove(2, 0, 'X');
      const result = engine.makeMove(2, 1, 'O');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.winner).toBe('O');
    });

    it('detects right column win', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(0, 2, 'O');
      engine.makeMove(1, 0, 'X');
      engine.makeMove(1, 2, 'O');
      engine.makeMove(2, 1, 'X');
      const result = engine.makeMove(2, 2, 'O');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.winner).toBe('O');
    });
  });

  describe('diagonal wins', () => {
    it('detects top-left to bottom-right diagonal win for X', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(0, 1, 'O');
      engine.makeMove(1, 1, 'X');
      engine.makeMove(0, 2, 'O');
      const result = engine.makeMove(2, 2, 'X');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.winner).toBe('X');
    });

    it('detects top-right to bottom-left diagonal win for O', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(0, 2, 'O');
      engine.makeMove(1, 0, 'X');
      engine.makeMove(1, 1, 'O');
      engine.makeMove(2, 0, 'X');
      const result = engine.makeMove(2, 0, 'O');
      expect(result.success).toBe(false);
    });

    it('detects top-right to bottom-left diagonal win for O (correct moves)', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(0, 2, 'O');
      engine.makeMove(1, 0, 'X');
      engine.makeMove(1, 1, 'O');
      engine.makeMove(2, 1, 'X');
      const result = engine.makeMove(2, 0, 'O');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.winner).toBe('O');
    });
  });

  describe('draw detection', () => {
    it('detects draw when board is full with no winner', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(0, 1, 'O');
      engine.makeMove(1, 1, 'X');
      engine.makeMove(0, 2, 'O');
      engine.makeMove(2, 0, 'X');
      engine.makeMove(1, 0, 'O');
      engine.makeMove(2, 1, 'X');
      engine.makeMove(2, 2, 'O');
      const result = engine.makeMove(1, 2, 'X');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.isDraw).toBe(true);
      expect(state.winner).toBe(null);
    });
  });

  describe('reset', () => {
    it('resets board to empty state', () => {
      engine.makeMove(0, 0, 'X');
      engine.makeMove(0, 1, 'O');
      engine.makeMove(0, 2, 'X');
      engine.reset();
      const state = engine.getState();
      expect(state.board).toEqual([
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ]);
      expect(state.winner).toBe(null);
      expect(state.isDraw).toBe(false);
      expect(state.currentPlayer).toBe('X');
      expect(state.moveCount).toBe(0);
    });

    it('allows moves after reset', () => {
      engine.makeMove(0, 0, 'X');
      engine.reset();
      const result = engine.makeMove(1, 1, 'X');
      expect(result.success).toBe(true);
      const state = engine.getState();
      expect(state.board[1]![1]).toBe('X');
    });
  });
});
