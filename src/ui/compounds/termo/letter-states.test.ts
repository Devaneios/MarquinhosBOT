import { describe, expect, test } from 'bun:test';
import { buildLetterStates } from './letter-states';

describe('buildLetterStates', () => {
  test('returns empty object when no guesses', () => {
    expect(buildLetterStates([])).toEqual({});
  });

  test('maps each letter to its feedback', () => {
    const result = buildLetterStates([
      { guess: 'abc', feedback: ['correct', 'present', 'absent'] },
    ]);
    expect(result).toEqual({ a: 'correct', b: 'present', c: 'absent' });
  });

  test('prioritizes correct > present > absent across guesses', () => {
    const result = buildLetterStates([
      { guess: 'aa', feedback: ['absent', 'present'] },
      { guess: 'aa', feedback: ['correct', 'absent'] },
    ]);
    expect(result).toEqual({ a: 'correct' });
  });

  test('strips diacritics for keyboard-row letters', () => {
    const result = buildLetterStates([{ guess: 'á', feedback: ['correct'] }]);
    expect(result).toEqual({ a: 'correct' });
  });

  test('keeps ç as-is because it is on the keyboard', () => {
    const result = buildLetterStates([{ guess: 'ç', feedback: ['correct'] }]);
    expect(result).toEqual({ ç: 'correct' });
  });
});
