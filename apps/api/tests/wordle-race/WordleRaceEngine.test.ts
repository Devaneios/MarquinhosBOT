import { beforeEach, describe, expect, it } from 'bun:test';

process.env.SQLITE_PATH = ':memory:';

const { WordleRaceEngine } =
  await import('../../src/services/activity/wordle-race/WordleRaceEngine');

function expectError<T extends { error: string } | object>(
  result: T,
): asserts result is Extract<T, { error: string }> {
  expect('error' in result).toBe(true);
}

function expectSolved<T extends { solved: boolean } | object>(
  result: T,
): asserts result is Extract<T, { solved: boolean }> {
  expect('error' in result).toBe(false);
}

describe('WordleRaceEngine', () => {
  let engine: InstanceType<typeof WordleRaceEngine>;
  const targetWord = 'abrir';

  beforeEach(() => {
    engine = new WordleRaceEngine(targetWord);
  });

  describe('addPlayer', () => {
    it('adds a new player with initial state', () => {
      engine.addPlayer('user1');
      const state = engine.getState();
      expect(state.players.has('user1')).toBe(true);
      const player = state.players.get('user1');
      expect(player?.solved).toBe(false);
      expect(player?.exhausted).toBe(false);
      expect(player?.guesses.length).toBe(0);
      expect(player?.attempts).toBe(0);
    });

    it('does not duplicate player if added twice', () => {
      engine.addPlayer('user1');
      engine.addPlayer('user1');
      const state = engine.getState();
      expect(Array.from(state.players.keys())).toEqual(['user1']);
    });
  });

  describe('submitGuess', () => {
    beforeEach(() => {
      engine.addPlayer('user1');
    });

    it('returns error if player not in room', () => {
      const result = engine.submitGuess('user999', 'hello');
      expectError(result);
      expect(result.error).toBe('Player not in room');
    });

    it('returns feedback for a valid guess', () => {
      const result = engine.submitGuess('user1', 'abrir');
      expectSolved(result);
      expect(result.solved).toBe(true);
      expect(result.feedback).toHaveLength(5);
      expect(result.feedback).toEqual([
        'correct',
        'correct',
        'correct',
        'correct',
        'correct',
      ]);
    });

    it('returns correct feedback for partial matches', () => {
      const result = engine.submitGuess('user1', 'acaso');
      expectSolved(result);
      expect(result.solved).toBe(false);
      expect(result.feedback.length).toBe(5);
    });

    it('returns error if word is invalid', () => {
      const result = engine.submitGuess('user1', 'xxxxx');
      expectError(result);
      expect(result.error).toBe('Invalid word');
    });

    it('returns error if word length does not match', () => {
      const result = engine.submitGuess('user1', 'cat');
      expectError(result);
      expect(result.error).toContain('5 letters long');
    });

    it('returns error if already solved', () => {
      engine.submitGuess('user1', 'abrir');
      const result = engine.submitGuess('user1', 'acaso');
      expectError(result);
      expect(result.error).toBe('Already solved');
    });

    it('returns error if word already guessed', () => {
      engine.submitGuess('user1', 'acaso');
      const result = engine.submitGuess('user1', 'acaso');
      expectError(result);
      expect(result.error).toBe('Already guessed this word');
    });

    it('tracks multiple guesses', () => {
      engine.submitGuess('user1', 'acaso');
      engine.submitGuess('user1', 'aceso');
      engine.submitGuess('user1', 'abrir');

      const state = engine.getState();
      const player = state.players.get('user1');
      expect(player?.guesses).toHaveLength(3);
      expect(player?.attempts).toBe(3);
      expect(player?.solved).toBe(true);
    });

    it('marks player exhausted after 6 attempts', () => {
      const words = ['acaba', 'acabo', 'acaju', 'acari', 'acaso', 'aceno'];
      for (const word of words) {
        engine.submitGuess('user1', word);
      }

      const state = engine.getState();
      const player = state.players.get('user1');
      expect(player?.exhausted).toBe(true);
      expect(player?.attempts).toBe(6);
    });

    it('returns error when attempting after exhausted', () => {
      const words = ['acaba', 'acabo', 'acaju', 'acari', 'acaso', 'aceno'];
      for (const word of words) {
        engine.submitGuess('user1', word);
      }

      const result = engine.submitGuess('user1', 'abrir');
      expectError(result);
      expect(result.error).toBe('No attempts remaining');
    });
  });

  describe('firstSolver tracking', () => {
    it('sets firstSolver when first player solves', () => {
      engine.addPlayer('user1');
      engine.addPlayer('user2');

      engine.submitGuess('user1', 'acaso');
      engine.submitGuess('user2', 'abrir');

      const state = engine.getState();
      expect(state.firstSolver).toBe('user2');
    });

    it('does not change firstSolver if another player solves later', () => {
      engine.addPlayer('user1');
      engine.addPlayer('user2');

      engine.submitGuess('user1', 'abrir');
      engine.submitGuess('user2', 'abrir');

      const state = engine.getState();
      expect(state.firstSolver).toBe('user1');
    });
  });

  describe('isGameOver', () => {
    it('returns false if no players', () => {
      expect(engine.isGameOver()).toBe(false);
    });

    it('returns false if player still has attempts and not solved', () => {
      engine.addPlayer('user1');
      expect(engine.isGameOver()).toBe(false);
    });

    it('returns true when player solves', () => {
      engine.addPlayer('user1');
      engine.submitGuess('user1', 'abrir');
      expect(engine.isGameOver()).toBe(true);
    });

    it('returns true when player exhausts attempts', () => {
      engine.addPlayer('user1');
      const words = ['acaba', 'acabo', 'acaju', 'acari', 'acaso', 'aceno'];
      for (const word of words) {
        engine.submitGuess('user1', word);
      }
      expect(engine.isGameOver()).toBe(true);
    });

    it('returns true when all players either solved or exhausted', () => {
      engine.addPlayer('user1');
      engine.addPlayer('user2');

      engine.submitGuess('user1', 'abrir');
      const words = ['acaba', 'acabo', 'acaju', 'acari', 'acaso', 'aceno'];
      for (const word of words) {
        engine.submitGuess('user2', word);
      }

      expect(engine.isGameOver()).toBe(true);
    });

    it('returns false if one player still has attempts', () => {
      engine.addPlayer('user1');
      engine.addPlayer('user2');

      engine.submitGuess('user1', 'hello');
      engine.submitGuess('user2', 'world');

      expect(engine.isGameOver()).toBe(false);
    });
  });

  describe('getTargetWord', () => {
    it('returns the target word', () => {
      expect(engine.getTargetWord()).toBe('abrir');
    });
  });

  describe('case insensitivity', () => {
    it('accepts uppercase guesses', () => {
      engine.addPlayer('user1');
      const result = engine.submitGuess('user1', 'ABRIR');
      expectSolved(result);
      expect(result.solved).toBe(true);
    });

    it('accepts mixed case guesses', () => {
      engine.addPlayer('user1');
      const result = engine.submitGuess('user1', 'AbRiR');
      expectSolved(result);
      expect(result.solved).toBe(true);
    });
  });
});
