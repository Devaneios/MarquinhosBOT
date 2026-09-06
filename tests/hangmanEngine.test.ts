import { describe, expect, it } from 'bun:test';
import { HangmanEngine } from 'services/activity/hangman/HangmanEngine';

describe('HangmanEngine', () => {
  it('initializes with word, no guessed letters, and 6 strikes remaining', () => {
    const engine = new HangmanEngine('gatos');
    const state = engine.getState();

    expect(state.word).toBe('gatos');
    expect(state.guessedLetters).toEqual(new Set());
    expect(state.strikes).toBe(0);
    expect(state.maxStrikes).toBe(6);
    expect(state.gameOver).toBe(false);
    expect(state.won).toBe(false);
  });

  it('reveals guessed letters in the correct positions', () => {
    const engine = new HangmanEngine('gatos');
    engine.guessLetter('a');
    const state = engine.getState();

    expect(state.guessedLetters).toEqual(new Set(['a']));
    expect(state.strikes).toBe(0);
  });

  it('increments strikes when guessing a letter not in the word', () => {
    const engine = new HangmanEngine('gatos');
    engine.guessLetter('x');
    const state = engine.getState();

    expect(state.guessedLetters).toEqual(new Set(['x']));
    expect(state.strikes).toBe(1);
  });

  it('rejects duplicate letter guesses', () => {
    const engine = new HangmanEngine('gatos');
    const result1 = engine.guessLetter('a');
    const result2 = engine.guessLetter('a');

    expect(result1).toBe(true);
    expect(result2).toBe(false);
  });

  it('detects win when all letters are guessed', () => {
    const engine = new HangmanEngine('abc');
    engine.guessLetter('a');
    engine.guessLetter('b');
    const state1 = engine.getState();
    expect(state1.won).toBe(false);

    engine.guessLetter('c');
    const state2 = engine.getState();
    expect(state2.won).toBe(true);
    expect(state2.gameOver).toBe(true);
  });

  it('detects loss when strikes reach maxStrikes', () => {
    const engine = new HangmanEngine('xyz');
    engine.guessLetter('a');
    engine.guessLetter('b');
    engine.guessLetter('c');
    engine.guessLetter('d');
    engine.guessLetter('e');
    const state1 = engine.getState();
    expect(state1.gameOver).toBe(false);

    engine.guessLetter('f');
    const state2 = engine.getState();
    expect(state2.gameOver).toBe(true);
    expect(state2.won).toBe(false);
  });

  it('prevents guesses after game is over', () => {
    const engine = new HangmanEngine('abc');
    engine.guessLetter('x');
    engine.guessLetter('y');
    engine.guessLetter('z');
    engine.guessLetter('w');
    engine.guessLetter('v');
    engine.guessLetter('u');

    const result = engine.guessLetter('a');
    expect(result).toBe(false);
  });

  it('provides revealed word with underscores for unrevealed letters', () => {
    const engine = new HangmanEngine('gatos');
    expect(engine.getRevealedWord()).toBe('_____');

    engine.guessLetter('a');
    expect(engine.getRevealedWord()).toBe('_a___');

    engine.guessLetter('g');
    expect(engine.getRevealedWord()).toBe('ga___');

    engine.guessLetter('s');
    expect(engine.getRevealedWord()).toBe('ga__s');
  });

  it('is case-insensitive', () => {
    const engine = new HangmanEngine('Gatos');
    engine.guessLetter('G');
    const state = engine.getState();
    expect(state.guessedLetters).toEqual(new Set(['g']));
    expect(engine.getRevealedWord()).toBe('G____');
  });

  it('handles words with repeated letters', () => {
    const engine = new HangmanEngine('banana');
    engine.guessLetter('a');
    expect(engine.getRevealedWord()).toBe('_a_a_a');

    engine.guessLetter('b');
    expect(engine.getRevealedWord()).toBe('ba_a_a');
  });
});
