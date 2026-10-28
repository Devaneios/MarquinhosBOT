import { describe, expect, it } from 'bun:test';
import { stripDiacritics } from '../../../shared/text/stripDiacritics';
import { computeFeedback } from '../feedback';
import { matchWordlePatterns } from './engine/matchPatterns';
import witnesses from './fixtures/legal-witnesses.json';
import { WORDLE_PATTERN_CATALOG } from './patterns';

describe('legal source-bank witnesses', () => {
  it('proves all 53 templates and every wider variant separately in both colors through production feedback', () => {
    for (const base of WORDLE_PATTERN_CATALOG) {
      const forms = [base.mask, ...(base.variants ?? [])];
      for (const [variant, mask] of forms.entries()) {
        const pattern = { ...base, mask, variants: [] };
        for (const color of ['correct', 'present'] as const) {
          const witness = witnesses.find(
            (w) =>
              w.patternId === pattern.id &&
              ((w as { variant?: number }).variant ?? 0) === variant &&
              w.color === color,
          );
          if (!witness)
            throw new Error(`Missing ${pattern.id}#${variant}/${color}`);
          const guesses = witness.guesses.map(stripDiacritics);
          expect(new Set(guesses).size).toBe(guesses.length);
          const feedback = guesses.map((guess) =>
            computeFeedback(guess, stripDiacritics(witness.answer)),
          );
          expect(feedback.at(-1)?.every((cell) => cell === 'correct')).toBe(
            true,
          );
          expect(
            feedback
              .slice(0, -1)
              .every((row) => row.some((cell) => cell !== 'correct')),
          ).toBe(true);
          expect(
            matchWordlePatterns(feedback).find(
              (match) => match.patternId === pattern.id,
            )?.color,
          ).toBe(color);
          expect(
            matchWordlePatterns(feedback, [
              { ...pattern, colors: [color], rotations: [0] },
            ])[0]?.color,
          ).toBe(color);
        }
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
