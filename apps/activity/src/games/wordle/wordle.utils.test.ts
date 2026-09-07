import { describe, expect, it } from 'bun:test';
import { buildLetterStates, normalizeKey } from './wordle.utils';

describe('normalizeKey', () => {
  it('normalizes case and supported accented letters', () => {
    expect(normalizeKey('Q')).toBe('q');
    expect(normalizeKey('Á')).toBe('a');
  });

  it('preserves unsupported symbols after lowercasing', () => {
    expect(normalizeKey('1')).toBe('1');
    expect(normalizeKey('!')).toBe('!');
  });
});

describe('buildLetterStates', () => {
  it('keeps the strongest feedback for each letter', () => {
    expect(
      buildLetterStates([
        {
          guess: 'crane',
          feedback: ['absent', 'present', 'absent', 'absent', 'correct'],
        },
        {
          guess: 'caper',
          feedback: ['correct', 'absent', 'present', 'absent', 'absent'],
        },
      ]),
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
