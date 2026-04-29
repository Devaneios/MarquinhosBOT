import { formatGuessesAsText } from '@marquinhos/ui/compounds/termo/text-fallback';
import { describe, expect, test } from 'bun:test';

describe('formatGuessesAsText', () => {
  test('returns empty string for no guesses', () => {
    expect(formatGuessesAsText([])).toBe('');
  });

  test('formats a 5-letter guess as WORD: emojis', () => {
    expect(
      formatGuessesAsText([
        {
          guess: 'termo',
          feedback: ['correct', 'present', 'absent', 'absent', 'present'],
        },
      ]),
    ).toBe('TERMO: 🟩🟨⬛⬛🟨');
  });

  test('formats a 6-letter all-absent guess', () => {
    expect(
      formatGuessesAsText([
        {
          guess: 'brasil',
          feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'absent'],
        },
      ]),
    ).toBe('BRASIL: ⬛⬛⬛⬛⬛⬛');
  });

  test('maps correct/present/absent to the right emoji', () => {
    expect(
      formatGuessesAsText([
        { guess: 'abc', feedback: ['correct', 'present', 'absent'] },
      ]),
    ).toBe('ABC: 🟩🟨⬛');
  });

  test('formats multiple guesses as separate lines', () => {
    expect(
      formatGuessesAsText([
        { guess: 'abc', feedback: ['correct', 'absent', 'absent'] },
        { guess: 'def', feedback: ['absent', 'present', 'correct'] },
      ]),
    ).toBe('ABC: 🟩⬛⬛\nDEF: ⬛🟨🟩');
  });

  test('uppercases diacritic letters', () => {
    expect(
      formatGuessesAsText([
        { guess: 'ação', feedback: ['correct', 'present', 'absent', 'correct'] },
      ]),
    ).toBe('AÇÃO: 🟩🟨⬛🟩');
  });
});
