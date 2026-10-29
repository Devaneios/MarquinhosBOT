import { describe, expect, it } from 'bun:test';
import { stripDiacritics } from '../../../shared/text/stripDiacritics';
import { computeFeedback } from '../feedback';
import { matchWordlePatterns } from './engine/matchPatterns';
import witnesses from './fixtures/legal-witnesses.json';
import {
  missingWordlePatternWitnesses,
  requiredWordlePatternWitnesses,
} from './fixtures/witnessCoverage';
import { WORDLE_PATTERN_CATALOG } from './patterns';

describe('legal source-bank witnesses', () => {
  it('proves all 53 templates and every wider variant separately in both colors through production feedback', () => {
    expect(
      missingWordlePatternWitnesses(WORDLE_PATTERN_CATALOG, witnesses),
    ).toEqual([]);
    for (const { patternId, variant, color } of requiredWordlePatternWitnesses(
      WORDLE_PATTERN_CATALOG,
    )) {
      const base = WORDLE_PATTERN_CATALOG.find(
        (pattern) => pattern.id === patternId,
      );
      if (!base) throw new Error(`Missing pattern ${patternId}`);
      const pattern = {
        ...base,
        mask: [base.mask, ...(base.variants ?? [])][variant] ?? base.mask,
        variants: [],
      };
      const witness = witnesses.find(
        (entry) =>
          entry.patternId === pattern.id &&
          (entry.variant ?? 0) === variant &&
          entry.color === color,
      );
      if (!witness)
        throw new Error(`Missing ${pattern.id}#${variant}/${color}`);
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
