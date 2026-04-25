import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildKeyboardImage,
  buildResultImage,
  buildWordPreviewImage,
  type LetterFeedback,
} from './termo';

const OUT_DIR = join(import.meta.dir, '../../../test-output');

const guesses: { guess: string; feedback: LetterFeedback[] }[] = [
  {
    guess: 'brasil',
    feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'quando',
    feedback: ['absent', 'absent', 'absent', 'present', 'absent', 'present'],
  },
  {
    guess: 'fervem',
    feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'pontos',
    feedback: ['present', 'present', 'present', 'correct', 'present', 'absent'],
  },
  {
    guess: 'tonhop',
    feedback: ['correct', 'present', 'correct', 'absent', 'present', 'present'],
  },
  {
    guess: 'topnol',
    feedback: ['correct', 'present', 'absent', 'correct', 'present', 'absent'],
  },
  {
    guess: 'tronpo',
    feedback: ['correct', 'absent', 'present', 'correct', 'absent', 'correct'],
  },
  {
    guess: 'tozinp',
    feedback: ['correct', 'correct', 'absent', 'absent', 'correct', 'absent'],
  },
  {
    guess: 'togonp',
    feedback: ['correct', 'correct', 'absent', 'absent', 'correct', 'absent'],
  },
  {
    guess: 'toxnpo',
    feedback: ['correct', 'correct', 'absent', 'correct', 'absent', 'correct'],
  },
  {
    guess: 'townpo',
    feedback: ['correct', 'correct', 'absent', 'correct', 'absent', 'correct'],
  },
  {
    guess: 'toento',
    feedback: ['correct', 'correct', 'absent', 'correct', 'correct', 'correct'],
  },
];

mkdirSync(OUT_DIR, { recursive: true });

const keyboardBuffer = await buildKeyboardImage(guesses, 6, {
  maxAttempts: 12,
  streak: 7,
  status: { attempts: 12 },
});
writeFileSync(join(OUT_DIR, 'termo-keyboard.png'), keyboardBuffer);

const resultBuffer = await buildResultImage(guesses);
writeFileSync(join(OUT_DIR, 'termo-result.png'), resultBuffer);

const wordPreviewBuffer = await buildWordPreviewImage('termos');
writeFileSync(join(OUT_DIR, 'termo-word-preview.png'), wordPreviewBuffer);

console.log(`wrote ${OUT_DIR}/termo-keyboard.png`);
console.log(`wrote ${OUT_DIR}/termo-result.png`);
console.log(`wrote ${OUT_DIR}/termo-word-preview.png`);
