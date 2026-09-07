import { describe, expect, it } from 'bun:test';
import { WordChainEngine } from 'services/activity/word-chain/WordChainEngine';

describe('WordChainEngine', () => {
  it('initializes with empty players and no current word', () => {
    const engine = new WordChainEngine();
    const state = engine.getState();

    expect(state.gameOver).toBe(false);
    expect(state.winner).toBe(null);
    expect(state.players).toEqual([]);
    expect(state.usedWords).toEqual(new Set());
    expect(state.currentWord).toBe('');
  });

  it('adds a player to the game', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');
    const state = engine.getState();

    expect(state.players).toHaveLength(1);
    expect(state.players[0]).toEqual({ userId: 'user-1', alive: true });
  });

  it('rejects adding the same player twice', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');
    engine.addPlayer('user-1');
    const state = engine.getState();

    expect(state.players).toHaveLength(1);
  });

  it('validates word starts with correct letter', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');
    engine.addPlayer('user-2');
    engine.addPlayer('user-3');

    // First word (no requirement)
    let result = engine.submitWord('user-1', 'abelha');
    expect(result.valid).toBe(true);

    // Next word must start with 'a'
    result = engine.submitWord('user-2', 'abate');
    expect(result.valid).toBe(true);

    // Next word must start with 'e'
    result = engine.submitWord('user-3', 'efeito');
    expect(result.valid).toBe(true);

    // Word starting with wrong letter (not 'o') - using abater which is in dictionary but starts with 'a'
    result = engine.submitWord('user-1', 'abater');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must start with');
  });

  it('rejects words not in dictionary', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');

    const result = engine.submitWord('user-1', 'xyzabc');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Word not in dictionary');
  });

  it('rejects duplicate words in same game', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');
    engine.addPlayer('user-2');

    engine.submitWord('user-1', 'abelha');
    engine.submitWord('user-2', 'abate');

    const result = engine.submitWord('user-1', 'abelha');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Word already used');
  });

  it('advances turn after successful word submission', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');
    engine.addPlayer('user-2');

    const state1 = engine.getState();
    expect(state1.currentTurn).toBe('user-1');

    engine.submitWord('user-1', 'abelha');

    const state2 = engine.getState();
    expect(state2.currentTurn).toBe('user-2');
  });

  it('rejects submission from non-current player', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');
    engine.addPlayer('user-2');

    const result = engine.submitWord('user-2', 'gato');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Not your turn');
  });

  it('eliminates player and detects single survivor win', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');
    engine.addPlayer('user-2');

    let state = engine.getState();
    expect(state.gameOver).toBe(false);

    engine.removePlayer('user-1');

    state = engine.getState();
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe('user-2');
  });

  it('skips eliminated players during turn advancement', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');
    engine.addPlayer('user-2');
    engine.addPlayer('user-3');

    engine.submitWord('user-1', 'abelha');
    engine.submitWord('user-2', 'abate');
    engine.removePlayer('user-2');
    engine.submitWord('user-3', 'efeito');

    const state = engine.getState();
    expect(state.currentTurn).toBe('user-1');
  });

  it('hands the turn to the next alive player when the current-turn player is removed', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');
    engine.addPlayer('user-2');
    engine.addPlayer('user-3');

    // user-1 is up; removing them (a turn timeout or a disconnect) must not
    // leave currentTurn pointing at a player who can never submit again.
    engine.removePlayer('user-1');

    const state = engine.getState();
    expect(state.gameOver).toBe(false);
    expect(state.currentTurn).toBe('user-2');

    const accepted = engine.submitWord('user-2', 'abelha');
    expect(accepted.valid).toBe(true);
  });

  it('is case-insensitive', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');

    const result = engine.submitWord('user-1', 'ABELHA');
    expect(result.valid).toBe(true);

    const state = engine.getState();
    expect(state.currentWord).toBe('abelha');
  });

  it('trims whitespace from submissions', () => {
    const engine = new WordChainEngine();
    engine.addPlayer('user-1');

    const result = engine.submitWord('user-1', '  abelha  ');
    expect(result.valid).toBe(true);
  });
});
