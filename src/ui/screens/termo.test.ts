import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildKeyboardImage,
  buildNewWordImage,
  buildNoticeImage,
  buildResultImage,
  buildStatsImage,
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

const resultBuffer = await buildResultImage(guesses, 'TesterUser', {
  streak: 7,
});
writeFileSync(join(OUT_DIR, 'termo-result.png'), resultBuffer);

const newWordBuffer = await buildNewWordImage(
  {
    word: 'termos',
    wordLength: 6,
    wordDate: '2026-04-22',
    message: 'boa sorte (vao precisar).',
    stats: { playersCount: 14, winnersCount: 5, avgAttempts: 4.2 },
  },
  { revealWord: true, admin: true },
);
writeFileSync(join(OUT_DIR, 'termo-new-word.png'), newWordBuffer);

const statsBuffer = await buildStatsImage(
  {
    word: 'termos',
    wordDate: '2026-04-22',
    wordLength: 6,
    playersCount: 14,
    winnersCount: 5,
    avgAttempts: 4.2,
  },
  { revealWord: true },
);
writeFileSync(join(OUT_DIR, 'termo-stats.png'), statsBuffer);

const noticeBuffer = await buildNoticeImage(
  'TERMO CONFIGURADO',
  'Canal configurado para #termo.',
  { badge: 'ADMIN' },
);
writeFileSync(join(OUT_DIR, 'termo-notice.png'), noticeBuffer);

console.log(`wrote ${OUT_DIR}/termo-keyboard.png`);
console.log(`wrote ${OUT_DIR}/termo-result.png`);
console.log(`wrote ${OUT_DIR}/termo-new-word.png`);
console.log(`wrote ${OUT_DIR}/termo-stats.png`);
console.log(`wrote ${OUT_DIR}/termo-notice.png`);
