import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { stripDiacritics } from '../../../shared/text/stripDiacritics';
import { computeFeedback } from '../feedback';
import { WORDLE_DRAWING_CATALOG } from './catalog';
import { analyzeWordleAchievements } from './engine/evaluate';
import type { AchievementHistoryDay } from './engine/history';
import { matchWordlePatterns } from './engine/matchPatterns';
import witnesses from './fixtures/legal-witnesses.json';
import {
  missingWordlePatternWitnesses,
  requiredWordlePatternWitnesses,
} from './fixtures/witnessCoverage';

const readBank = (path: string) =>
  new Set(
    readFileSync(new URL(path, import.meta.url), 'utf8')
      .split(/\r?\n/)
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean),
  );
const answers = new Set([
  ...readBank('../../../../../../apps/api/wordlist.txt'),
  ...readBank('../../../../../../apps/api/devaneios-wordlist.txt'),
]);
const legalGuesses = readBank('../../../../../../apps/api/valid-guesses.txt');

function solvedHistory(
  answer: string,
  guesses: readonly string[],
): AchievementHistoryDay {
  return {
    date: '2026-10-29',
    solved: true,
    solvedFromDraft: false,
    attempts: guesses.length,
    guesses: guesses.map((guess) => ({
      guess: stripDiacritics(guess),
      feedback: computeFeedback(
        stripDiacritics(guess),
        stripDiacritics(answer),
      ),
    })),
    wordLength: answer.length,
    answerHasAccent: answer !== stripDiacritics(answer),
    answerHasRepeatedLetters:
      new Set(stripDiacritics(answer)).size < stripDiacritics(answer).length,
    startedAt: 1,
    solvedAt: 2,
    firstSolverInGuild: false,
  };
}

function expectLegalSequence(answer: string, guesses: readonly string[]) {
  expect(answers.has(answer)).toBe(true);
  const normalized = guesses.map(stripDiacritics);
  expect(new Set(normalized).size).toBe(normalized.length);
  expect(normalized.at(-1)).toBe(stripDiacritics(answer));
  expect(guesses.every((guess) => legalGuesses.has(guess.toLowerCase()))).toBe(
    true,
  );
}

describe('legal source-bank witnesses', () => {
  it('proves all 59 templates and every wider variant separately in both colors through production feedback', () => {
    expect(
      missingWordlePatternWitnesses(WORDLE_DRAWING_CATALOG, witnesses),
    ).toEqual([]);
    for (const { patternId, variant, color } of requiredWordlePatternWitnesses(
      WORDLE_DRAWING_CATALOG,
    )) {
      const base = WORDLE_DRAWING_CATALOG.find(
        (pattern) => pattern.patternId === patternId,
      );
      if (!base) throw new Error(`Missing drawing ${patternId}`);
      const pattern = {
        ...base,
        mask: [base.mask, ...(base.variants ?? [])][variant] ?? base.mask,
        variants: [],
      };
      const witness = witnesses.find(
        (entry) =>
          entry.patternId === pattern.patternId &&
          (entry.variant ?? 0) === variant &&
          entry.color === color,
      );
      if (!witness)
        throw new Error(`Missing ${pattern.patternId}#${variant}/${color}`);
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
          (match) => match.patternId === pattern.patternId,
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

  it('proves the confirmed feedback sequences through production scoring', () => {
    const sequences = [
      {
        answer: 'partes',
        guesses: ['bibico', 'bichon', 'partes'],
        achievement: 'wordle_v2_blank_twice_then_solved',
      },
      {
        answer: 'partes',
        guesses: ['cartes', 'fartes', 'partes'],
        achievement: 'wordle_v2_near_miss_twice',
      },
      {
        answer: 'castro',
        guesses: ['torças', 'traços', 'castro'],
        achievement: 'wordle_v2_yellow_only_before_solve',
      },
      {
        answer: 'castro',
        guesses: ['torças', 'castor', 'castro'],
        achievement: 'wordle_v2_anagrams_only_before_solve',
      },
    ];
    for (const sequence of sequences) {
      expectLegalSequence(sequence.answer, sequence.guesses);
      const evaluation = analyzeWordleAchievements(
        [solvedHistory(sequence.answer, sequence.guesses)],
        { today: '2026-10-29' },
      ).evaluate(new Set());
      expect(
        evaluation.find((row) => row.id === sequence.achievement)?.met,
      ).toBe(true);
    }
    const yellowRows = sequences[2]!.guesses
      .slice(0, -1)
      .map((guess) => computeFeedback(stripDiacritics(guess), 'castro'));
    expect(
      yellowRows.every((row) => row.every((cell) => cell === 'present')),
    ).toBe(true);
    const mixedRows = sequences[3]!.guesses
      .slice(0, -1)
      .map((guess) => computeFeedback(stripDiacritics(guess), 'castro'));
    expect(
      mixedRows.every((row) => row.every((cell) => cell !== 'absent')),
    ).toBe(true);
  });

  it('verifies both supplied six-column triangle witnesses', () => {
    const examples = [
      {
        answer: 'partes',
        guesses: ['certar', 'cartel', 'partes'],
        color: 'correct',
      },
      {
        answer: 'castro',
        guesses: ['becape', 'borcar', 'torças', 'castro'],
        color: 'present',
      },
    ] as const;
    const triangle = WORDLE_DRAWING_CATALOG.find(
      (pattern) => pattern.patternId === 'triangle_6',
    );
    if (!triangle) throw new Error('Missing triangle_6');

    for (const example of examples) {
      expectLegalSequence(example.answer, example.guesses);
      const matrix = example.guesses.map((guess) =>
        computeFeedback(
          stripDiacritics(guess),
          stripDiacritics(example.answer),
        ),
      );
      expect(
        matchWordlePatterns(matrix, [triangle]).find(
          (match) => match.patternId === 'triangle_6',
        )?.color,
      ).toBe(example.color);
    }
  });
});
