import { describe, expect, it } from 'bun:test';
import { stripDiacritics } from '../../../shared/text/stripDiacritics';
import { computeFeedback } from '../feedback';
import witnesses from './fixtures/legal-witnesses.json';
import { matchWordlePatterns } from './matchPatterns';
import { WORDLE_PATTERN_CATALOG } from './patterns';

describe('legal source-bank witnesses', () => {
  it('proves all 53 templates separately in both colors through production feedback', () => {
    for (const pattern of WORDLE_PATTERN_CATALOG) {
      for (const color of ['correct', 'present'] as const) {
        const witness = witnesses.find(
          (w) => w.patternId === pattern.id && w.color === color,
        );
        if (!witness) throw new Error(`Missing ${pattern.id}/${color}`);
        const guesses = witness.guesses.map(stripDiacritics);
        expect(new Set(guesses).size).toBe(guesses.length);
        const feedback = guesses.map((guess) =>
          computeFeedback(guess, stripDiacritics(witness.answer)),
        );
        expect(feedback.at(-1)?.every((cell) => cell === 'correct')).toBe(true);
        expect(
          feedback
            .slice(0, -1)
            .every((row) => row.some((cell) => cell !== 'correct')),
        ).toBe(true);
        expect(
          matchWordlePatterns(feedback, [
            { ...pattern, colors: [color], rotations: [0] },
          ])[0]?.color,
        ).toBe(color);
      }
    }
  });
  it('provides yellow drawings without discarding any previously discovered green position', () => {
    for (const witness of witnesses.filter((w) => w.color === 'present')) {
      const greenPositions = new Set<number>();
      for (const guess of witness.guesses) {
        const feedback = computeFeedback(
          stripDiacritics(guess),
          stripDiacritics(witness.answer),
        );
        for (const position of greenPositions)
          expect(feedback[position]).toBe('correct');
        feedback.forEach((cell, position) => {
          if (cell === 'correct') greenPositions.add(position);
        });
      }
    }
  });
});
