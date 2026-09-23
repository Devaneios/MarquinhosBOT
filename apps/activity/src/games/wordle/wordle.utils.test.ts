import {
  buildLetterStates,
  normalizeKey,
} from '@marquinhos/domain/wordle/keyboardState';
import { describe, expect, it } from 'bun:test';
import { KB_LETTERS } from './constants';

describe('normalizeKey', () => {
  it('normalizes case and supported accented letters', () => {
    expect(normalizeKey('Q', KB_LETTERS)).toBe('q');
    expect(normalizeKey('Á', KB_LETTERS)).toBe('a');
  });

  it('preserves unsupported symbols after lowercasing', () => {
    expect(normalizeKey('1', KB_LETTERS)).toBe('1');
    expect(normalizeKey('!', KB_LETTERS)).toBe('!');
  });
});

describe('buildLetterStates', () => {
  it('keeps the strongest feedback for each letter', () => {
    expect(
      buildLetterStates(
        [
          {
            guess: 'crane',
            feedback: ['absent', 'present', 'absent', 'absent', 'correct'],
          },
          {
            guess: 'caper',
            feedback: ['correct', 'absent', 'present', 'absent', 'absent'],
          },
        ],
        KB_LETTERS,
      ),
    ).toEqual({
      c: 'correct',
      r: 'present',
      a: 'absent',
      n: 'absent',
      e: 'correct',
      p: 'present',
    });
  });
});
