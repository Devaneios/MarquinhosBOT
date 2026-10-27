import { matchWordlePatterns } from '@marquinhos/domain/games/wordle/achievements/matchPatterns';
import {
  WORDLE_PATTERN_CATALOG,
  type WordlePatternDefinition,
} from '@marquinhos/domain/games/wordle/achievements/patterns';
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
  color: z.enum(['correct', 'present']),
  answer: z.string(),
  guesses: z.array(z.string()),
  origin: z.tuple([z.number(), z.number()]),
});
type Witness = z.infer<typeof witnessSchema>;

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
  pattern: WordlePatternDefinition,
  color: Witness['color'],
  answer: string,
  feedback: readonly {
    guess: string;
    states: ReturnType<typeof computeFeedback>;
  }[],
): Witness | null {
  const width = pattern.mask[0]?.length ?? 0;
  for (let column = 0; column + width <= answer.length; column++) {
    const candidates = pattern.mask.map((mask) =>
      feedback
        .filter(
          (row) =>
            (color !== 'present' || !row.states.includes('correct')) &&
            [...mask].every(
              (cell, c) => cell !== '#' || row.states[c + column] === color,
            ),
        )
        .slice(0, pattern.mask.length + 1)
        .map((row) => row.guess),
    );
    if (candidates.some((row) => row.length === 0)) continue;
    const selected = chooseRows(candidates, new Set([stripDiacritics(answer)]));
    if (selected)
      return {
        patternId: pattern.id,
        color,
        answer,
        guesses: [...selected, answer],
        origin: [0, column],
      };
  }
  return null;
}

function search(): Witness[] {
  const pending = new Map(
    WORDLE_PATTERN_CATALOG.flatMap((pattern) =>
      (['correct', 'present'] as const).map((color) => [
        `${pattern.id}:${color}`,
        { pattern, color },
      ]),
    ),
  );
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
    for (const [key, { pattern, color }] of pending) {
      const witness = findWitness(pattern, color, answer, feedback);
      if (witness) {
        witnesses.push(witness);
        pending.delete(key);
      }
    }
    process.stderr.write(
      `Searched ${answer}; ${witnesses.length}/106 color witnesses\n`,
    );
  }
  const missing = WORDLE_PATTERN_CATALOG.filter(
    (pattern) => !witnesses.some((w) => w.patternId === pattern.id),
  );
  if (missing.length)
    throw new Error(
      `Unreachable after exhaustive source-bank search: ${missing.map((p) => p.id).join(', ')}`,
    );
  if (pending.size)
    process.stderr.write(
      `Unproven alternate colors: ${[...pending.keys()].join(', ')}\n`,
    );
  return witnesses.sort(
    (a, b) =>
      a.patternId.localeCompare(b.patternId) || a.color.localeCompare(b.color),
  );
}

function verify(witnesses: Witness[]) {
  for (const witness of witnesses) {
    const pattern = WORDLE_PATTERN_CATALOG.find(
      (p) => p.id === witness.patternId,
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
    const match = matchWordlePatterns(matrix).find(
      (found) => found.patternId === pattern.id,
    );
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
  const missing = WORDLE_PATTERN_CATALOG.filter(
    (pattern) => !witnesses.some((w) => w.patternId === pattern.id),
  );
  if (missing.length)
    throw new Error(
      `Missing witnesses: ${missing.map((p) => p.id).join(', ')}`,
    );
  console.log(
    JSON.stringify({
      patterns: WORDLE_PATTERN_CATALOG.length,
      witnesses: witnesses.length,
      yellow: witnesses.filter((w) => w.color === 'present').length,
      sourceBanksVerified: true,
      livePool:
        'not checked; source witnesses may be used or banned in a live environment',
    }),
  );
}

if (import.meta.main) {
  if (process.argv.includes('--search')) {
    const witnesses = search();
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
