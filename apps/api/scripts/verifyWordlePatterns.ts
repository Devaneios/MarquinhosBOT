import { WORDLE_DRAWING_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { matchWordlePatterns } from '@marquinhos/domain/games/wordle/achievements/engine/matchPatterns';
import {
  missingWordlePatternWitnesses,
  requiredWordlePatternWitnesses,
  wordlePatternWitnessKey,
} from '@marquinhos/domain/games/wordle/achievements/fixtures/witnessCoverage';
import type { DrawingDefinition } from '@marquinhos/domain/games/wordle/achievements/types';
import { computeFeedback } from '@marquinhos/domain/games/wordle/feedback';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import { z } from 'zod';

const root = new URL('../', import.meta.url);
const fixturePath = fileURLToPath(
  new URL(
    '../../../packages/domain/src/games/wordle/achievements/fixtures/legal-witnesses.json',
    import.meta.url,
  ),
);
const readWords = (name: string) =>
  readFileSync(new URL(name, root), 'utf8')
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length === 5 || w.length === 6);
const answers = new Set([
  ...readWords('wordlist.txt'),
  ...readWords('devaneios-wordlist.txt'),
]);
const guesses = [
  ...new Map(
    readWords('valid-guesses.txt').map((word) => [stripDiacritics(word), word]),
  ).values(),
].sort();
const legalGuesses = new Set(readWords('valid-guesses.txt'));
const witnessSchema = z.object({
  patternId: z.string(),
  variant: z.number().int().nonnegative().optional(),
  color: z.enum(['correct', 'present']),
  answer: z.string(),
  guesses: z.array(z.string()),
  origin: z.tuple([z.number(), z.number()]),
});
type Witness = z.infer<typeof witnessSchema>;

/** One drawable form of a pattern: variant 0 is the base mask. */
const variantMasks = (pattern: DrawingDefinition) => [
  pattern.mask,
  ...(pattern.variants ?? []),
];
const variantTemplate = (
  pattern: DrawingDefinition,
  variant: number,
): DrawingDefinition => ({
  ...pattern,
  mask: variantMasks(pattern)[variant] ?? pattern.mask,
  variants: [],
});

function chooseRows(
  candidates: readonly string[][],
  used: Set<string>,
  row = 0,
): string[] | null {
  if (row === candidates.length) return [];
  for (const guess of candidates[row] ?? []) {
    const normalized = stripDiacritics(guess);
    if (used.has(normalized)) continue;
    used.add(normalized);
    const rest = chooseRows(candidates, used, row + 1);
    if (rest) return [guess, ...rest];
    used.delete(normalized);
  }
  return null;
}

function findWitness(
  pattern: DrawingDefinition,
  variant: number,
  color: Witness['color'],
  answer: string,
  feedback: readonly {
    guess: string;
    states: ReturnType<typeof computeFeedback>;
  }[],
): Witness | null {
  const rows = variantMasks(pattern)[variant] ?? pattern.mask;
  const width = rows[0]?.length ?? 0;
  const winningRowIsPartOfDrawing =
    color === 'correct' &&
    rows.at(-1)?.length === answer.length &&
    [...(rows.at(-1) ?? '')].every((cell) => cell === '#');
  for (let column = 0; column + width <= answer.length; column++) {
    // The drawing is the whole same-colored group, so no neighbor of the
    // mask, diagonals included, may share its color.
    const touching = rows.map((_, i) => {
      const columns = new Set<number>();
      for (const near of [rows[i - 1], rows[i], rows[i + 1]])
        [...(near ?? '')].forEach((cell, c) => {
          if (cell === '#') for (let d = -1; d <= 1; d++) columns.add(c + d);
        });
      return [...columns]
        .filter((c) => rows[i]?.[c] !== '#')
        .map((c) => c + column)
        .filter((c) => c >= 0 && c < answer.length);
    });
    const candidates = rows.map((mask, i) => {
      const matchingGuesses = feedback
        .filter(
          (row) =>
            (color !== 'present' || !row.states.includes('correct')) &&
            [...mask].every(
              (cell, c) => cell !== '#' || row.states[c + column] === color,
            ) &&
            (touching[i] ?? []).every((c) => row.states[c] !== color),
        )
        .slice(0, rows.length + 1)
        .map((row) => row.guess);
      if (winningRowIsPartOfDrawing && i === rows.length - 1)
        matchingGuesses.push(answer);
      return matchingGuesses;
    });
    if (candidates.some((row) => row.length === 0)) continue;
    const selected = chooseRows(
      candidates,
      winningRowIsPartOfDrawing
        ? new Set()
        : new Set([stripDiacritics(answer)]),
    );
    if (selected)
      return {
        patternId: pattern.patternId,
        ...(variant > 0 ? { variant } : {}),
        color,
        answer,
        guesses: winningRowIsPartOfDrawing ? selected : [...selected, answer],
        origin: [0, column],
      };
  }
  return null;
}

function search(patterns: readonly DrawingDefinition[]): Witness[] {
  const pending = new Map(
    requiredWordlePatternWitnesses(patterns).map((requirement) => {
      const pattern = patterns.find(
        (candidate) => candidate.patternId === requirement.patternId,
      );
      if (!pattern) throw new Error(`Unknown pattern ${requirement.patternId}`);
      return [
        wordlePatternWitnessKey(requirement),
        { pattern, variant: requirement.variant, color: requirement.color },
      ] as const;
    }),
  );
  const total = pending.size;
  const witnesses: Witness[] = [];
  const priority = [
    'cantos',
    'partes',
    'castro',
    'pedras',
    'pratos',
    'termos',
    'pasta',
    'porta',
    'pares',
    'termo',
  ];
  const ordered = [
    ...new Set([
      ...priority.filter((word) => answers.has(word)),
      ...[...answers].sort(),
    ]),
  ];
  for (const answer of ordered) {
    if (!pending.size) break;
    const normalized = stripDiacritics(answer);
    const feedback = guesses
      .filter(
        (guess) =>
          guess.length === answer.length &&
          stripDiacritics(guess) !== normalized,
      )
      .map((guess) => ({
        guess,
        states: computeFeedback(stripDiacritics(guess), normalized),
      }));
    for (const [key, { pattern, variant, color }] of pending) {
      const witness = findWitness(pattern, variant, color, answer, feedback);
      if (witness) {
        witnesses.push(witness);
        pending.delete(key);
      }
    }
    process.stderr.write(
      `Searched ${answer}; ${witnesses.length}/${total} color witnesses\n`,
    );
  }
  const unreachable = missingWordlePatternWitnesses(patterns, witnesses);
  if (unreachable.length)
    throw new Error(
      `Unreachable after exhaustive source-bank search: ${unreachable.join(', ')}`,
    );
  if (pending.size)
    process.stderr.write(
      `Unproven alternate colors: ${[...pending.keys()].join(', ')}\n`,
    );
  return witnesses.sort(
    (a, b) =>
      a.patternId.localeCompare(b.patternId) ||
      (a.variant ?? 0) - (b.variant ?? 0) ||
      a.color.localeCompare(b.color),
  );
}

function verify(witnesses: Witness[], selectedIds?: ReadonlySet<string>) {
  const selectedWitnesses = selectedIds
    ? witnesses.filter((witness) => selectedIds.has(witness.patternId))
    : witnesses;
  const selectedPatterns = selectedIds
    ? WORDLE_DRAWING_CATALOG.filter((pattern) =>
        selectedIds.has(pattern.patternId),
      )
    : WORDLE_DRAWING_CATALOG;
  for (const witness of selectedWitnesses) {
    const pattern = WORDLE_DRAWING_CATALOG.find(
      (p) => p.patternId === witness.patternId,
    );
    if (
      !pattern ||
      !answers.has(witness.answer) ||
      witness.guesses.some(
        (guess) =>
          !legalGuesses.has(guess) || guess.length !== witness.answer.length,
      )
    )
      throw new Error(`Invalid dictionary witness ${witness.patternId}`);
    const normalized = witness.guesses.map(stripDiacritics);
    if (
      new Set(normalized).size !== normalized.length ||
      normalized.at(-1) !== stripDiacritics(witness.answer) ||
      normalized.slice(0, -1).includes(stripDiacritics(witness.answer))
    )
      throw new Error(`Duplicate or early winning guess ${witness.patternId}`);
    const matrix = normalized.map((guess) =>
      computeFeedback(guess, stripDiacritics(witness.answer)),
    );
    if (witness.color === 'present') {
      const greens = new Set<number>();
      for (const row of matrix) {
        if ([...greens].some((position) => row[position] !== 'correct'))
          throw new Error(
            `Yellow witness discards known green ${witness.patternId}`,
          );
        row.forEach((cell, position) => {
          if (cell === 'correct') greens.add(position);
        });
      }
    }
    const match = matchWordlePatterns(matrix, [
      variantTemplate(pattern, witness.variant ?? 0),
    ]).find((found) => found.patternId === pattern.patternId);
    if (
      !match ||
      match.color !== witness.color ||
      match.origin[0] !== witness.origin[0] ||
      match.origin[1] !== witness.origin[1]
    )
      throw new Error(
        `Unverified drawing ${witness.patternId}/${witness.color}`,
      );
  }
  const missing = missingWordlePatternWitnesses(selectedPatterns, witnesses);
  if (missing.length)
    throw new Error(`Missing witnesses: ${missing.join(', ')}`);
  console.log(
    JSON.stringify({
      patterns: WORDLE_DRAWING_CATALOG.length,
      witnesses: witnesses.length,
      yellow: witnesses.filter((w) => w.color === 'present').length,
      sourceBanksVerified: true,
      livePool:
        'not checked; source witnesses may be used or banned in a live environment',
    }),
  );
}

if (import.meta.main) {
  const searchPatternIndex = process.argv.indexOf('--search-pattern');
  if (searchPatternIndex !== -1) {
    const patternId = process.argv[searchPatternIndex + 1];
    if (patternId === undefined)
      throw new Error('Pass a pattern id after --search-pattern.');
    const selected = WORDLE_DRAWING_CATALOG.filter(
      (pattern) => pattern.patternId === patternId,
    );
    if (selected.length === 0)
      throw new Error(`Unknown Wordle pattern: ${patternId}`);
    const existing = z
      .array(witnessSchema)
      .parse(JSON.parse(readFileSync(fixturePath, 'utf8')));
    const witnesses = [
      ...existing.filter((witness) => witness.patternId !== patternId),
      ...search(selected),
    ];
    verify(witnesses, new Set([patternId]));
    writeFileSync(
      fixturePath,
      await format(JSON.stringify(witnesses), { parser: 'json' }),
    );
  } else if (process.argv.includes('--search')) {
    const witnesses = search(WORDLE_DRAWING_CATALOG);
    verify(witnesses);
    writeFileSync(
      fixturePath,
      await format(JSON.stringify(witnesses), { parser: 'json' }),
    );
  } else {
    verify(
      z
        .array(witnessSchema)
        .parse(JSON.parse(readFileSync(fixturePath, 'utf8'))),
    );
  }
}
