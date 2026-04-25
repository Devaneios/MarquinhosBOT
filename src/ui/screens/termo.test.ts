import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildCrosswordImage,
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

// 2026-04-13 — "emojis" — 6 jogadores, todos os guesses únicos do dia
const emojisDay: { guess: string; feedback: LetterFeedback[] }[] = [
  {
    guess: 'arreio',
    feedback: ['present', 'present', 'absent', 'absent', 'absent', 'present'],
  },
  {
    guess: 'brigas',
    feedback: ['absent', 'absent', 'present', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'freios',
    feedback: ['absent', 'absent', 'present', 'present', 'present', 'correct'],
  },
  {
    guess: 'melhor',
    feedback: ['present', 'present', 'absent', 'absent', 'present', 'absent'],
  },
  {
    guess: 'imagem',
    feedback: ['present', 'correct', 'absent', 'absent', 'present', 'absent'],
  },
  {
    guess: 'emails',
    feedback: ['correct', 'correct', 'absent', 'present', 'absent', 'correct'],
  },
  {
    guess: 'radios',
    feedback: ['absent', 'absent', 'absent', 'present', 'present', 'correct'],
  },
  {
    guess: 'pintos',
    feedback: ['absent', 'present', 'absent', 'absent', 'present', 'correct'],
  },
  {
    guess: 'points',
    feedback: ['absent', 'present', 'present', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'sortis',
    feedback: ['absent', 'present', 'absent', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'olheis',
    feedback: ['present', 'absent', 'absent', 'present', 'correct', 'correct'],
  },
  {
    guess: 'lambeu',
    feedback: ['absent', 'absent', 'present', 'absent', 'present', 'absent'],
  },
  {
    guess: 'capeta',
    feedback: ['absent', 'absent', 'absent', 'present', 'absent', 'absent'],
  },
  {
    guess: 'vendia',
    feedback: ['absent', 'present', 'absent', 'absent', 'correct', 'absent'],
  },
  {
    guess: 'enguia',
    feedback: ['correct', 'absent', 'absent', 'absent', 'correct', 'absent'],
  },
  {
    guess: 'estiar',
    feedback: ['correct', 'present', 'absent', 'present', 'absent', 'absent'],
  },
  {
    guess: 'escoou',
    feedback: ['correct', 'present', 'absent', 'present', 'absent', 'absent'],
  },
  {
    guess: 'sambou',
    feedback: ['present', 'absent', 'present', 'absent', 'present', 'absent'],
  },
  {
    guess: 'fimose',
    feedback: ['absent', 'present', 'present', 'present', 'present', 'present'],
  },
  {
    guess: 'ensino',
    feedback: ['correct', 'absent', 'present', 'present', 'absent', 'present'],
  },
  {
    guess: 'lombar',
    feedback: ['absent', 'present', 'present', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'jeitos',
    feedback: ['present', 'present', 'present', 'absent', 'present', 'correct'],
  },
  {
    guess: 'bugado',
    feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'present'],
  },
  {
    guess: 'lotado',
    feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'mimosa',
    feedback: ['present', 'present', 'absent', 'present', 'present', 'absent'],
  },
  {
    guess: 'camada',
    feedback: ['absent', 'absent', 'present', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'risada',
    feedback: ['absent', 'present', 'present', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'simone',
    feedback: ['present', 'present', 'present', 'present', 'absent', 'present'],
  },
  {
    guess: 'aviões',
    feedback: ['absent', 'absent', 'present', 'absent', 'present', 'correct'],
  },
  {
    guess: 'amados',
    feedback: ['absent', 'correct', 'absent', 'absent', 'present', 'correct'],
  },
  {
    guess: 'errado',
    feedback: ['correct', 'absent', 'absent', 'absent', 'absent', 'present'],
  },
  {
    guess: 'miolos',
    feedback: ['present', 'present', 'correct', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'tabaco',
    feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'present'],
  },
  {
    guess: 'colega',
    feedback: ['absent', 'present', 'absent', 'present', 'absent', 'absent'],
  },
  {
    guess: 'pulsar',
    feedback: ['absent', 'absent', 'absent', 'present', 'absent', 'absent'],
  },
  {
    guess: 'vendas',
    feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'homens',
    feedback: ['absent', 'present', 'present', 'present', 'absent', 'correct'],
  },
  {
    guess: 'emoção',
    feedback: ['correct', 'correct', 'correct', 'absent', 'absent', 'absent'],
  },
];

// 2026-04-14 — "layout" — 6 jogadores, todos os guesses únicos do dia
const layoutDay: { guess: string; feedback: LetterFeedback[] }[] = [
  {
    guess: 'arreio',
    feedback: ['present', 'absent', 'absent', 'absent', 'absent', 'present'],
  },
  {
    guess: 'colada',
    feedback: ['absent', 'present', 'present', 'present', 'absent', 'absent'],
  },
  {
    guess: 'laguna',
    feedback: ['correct', 'correct', 'absent', 'present', 'absent', 'absent'],
  },
  {
    guess: 'lambeu',
    feedback: ['correct', 'correct', 'absent', 'absent', 'absent', 'present'],
  },
  {
    guess: 'julgou',
    feedback: ['absent', 'present', 'present', 'absent', 'present', 'absent'],
  },
  {
    guess: 'empuxo',
    feedback: ['absent', 'absent', 'absent', 'present', 'absent', 'present'],
  },
  {
    guess: 'pratos',
    feedback: ['absent', 'absent', 'present', 'present', 'present', 'absent'],
  },
  {
    guess: 'jatobá',
    feedback: ['absent', 'correct', 'present', 'correct', 'absent', 'absent'],
  },
  {
    guess: 'garota',
    feedback: ['absent', 'correct', 'absent', 'correct', 'present', 'absent'],
  },
  {
    guess: 'távola',
    feedback: ['present', 'correct', 'absent', 'correct', 'present', 'absent'],
  },
  {
    guess: 'ecdise',
    feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'kahoot',
    feedback: ['absent', 'correct', 'absent', 'correct', 'absent', 'correct'],
  },
  {
    guess: 'lâmina',
    feedback: ['correct', 'correct', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'radios',
    feedback: ['absent', 'correct', 'absent', 'absent', 'present', 'absent'],
  },
  {
    guess: 'pacote',
    feedback: ['absent', 'correct', 'absent', 'correct', 'present', 'absent'],
  },
  {
    guess: 'cannot',
    feedback: ['absent', 'correct', 'absent', 'absent', 'present', 'correct'],
  },
  {
    guess: 'logout',
    feedback: ['correct', 'absent', 'absent', 'correct', 'correct', 'correct'],
  },
  {
    guess: 'aborte',
    feedback: ['present', 'absent', 'present', 'absent', 'present', 'absent'],
  },
  {
    guess: 'pontas',
    feedback: ['absent', 'present', 'absent', 'present', 'present', 'absent'],
  },
  {
    guess: 'latido',
    feedback: ['correct', 'correct', 'present', 'absent', 'absent', 'present'],
  },
  {
    guess: 'facada',
    feedback: ['absent', 'correct', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'mamões',
    feedback: ['absent', 'correct', 'absent', 'correct', 'absent', 'absent'],
  },
  {
    guess: 'ralado',
    feedback: ['absent', 'correct', 'present', 'absent', 'absent', 'present'],
  },
  {
    guess: 'latões',
    feedback: ['correct', 'correct', 'present', 'correct', 'absent', 'absent'],
  },
  {
    guess: 'garoto',
    feedback: ['absent', 'correct', 'absent', 'correct', 'present', 'absent'],
  },
  {
    guess: 'lagoas',
    feedback: ['correct', 'correct', 'absent', 'correct', 'absent', 'absent'],
  },
  {
    guess: 'chorão',
    feedback: ['absent', 'absent', 'present', 'absent', 'present', 'absent'],
  },
  {
    guess: 'jurema',
    feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'present'],
  },
  {
    guess: 'lanche',
    feedback: ['correct', 'correct', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'virose',
    feedback: ['absent', 'absent', 'absent', 'correct', 'absent', 'absent'],
  },
  {
    guess: 'quorum',
    feedback: ['absent', 'absent', 'present', 'absent', 'correct', 'absent'],
  },
];

// 2026-04-03 — "guarda" — 6 jogadores, todos os guesses únicos do dia
const guardaDay: { guess: string; feedback: LetterFeedback[] }[] = [
  {
    guess: 'radios',
    feedback: ['present', 'present', 'present', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'drenar',
    feedback: ['present', 'present', 'absent', 'absent', 'present', 'absent'],
  },
  {
    guess: 'varada',
    feedback: ['absent', 'present', 'present', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'armada',
    feedback: ['present', 'present', 'absent', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'poesia',
    feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'futura',
    feedback: ['absent', 'correct', 'absent', 'absent', 'present', 'correct'],
  },
  {
    guess: 'furada',
    feedback: ['absent', 'correct', 'present', 'present', 'correct', 'correct'],
  },
  {
    guess: 'mudara',
    feedback: ['absent', 'correct', 'present', 'present', 'present', 'correct'],
  },
  {
    guess: 'arreio',
    feedback: ['present', 'present', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'talhar',
    feedback: ['absent', 'present', 'absent', 'absent', 'present', 'present'],
  },
  {
    guess: 'quadra',
    feedback: ['absent', 'correct', 'correct', 'present', 'present', 'correct'],
  },
  {
    guess: 'sapato',
    feedback: ['absent', 'present', 'absent', 'present', 'absent', 'absent'],
  },
  {
    guess: 'bafora',
    feedback: ['absent', 'present', 'absent', 'absent', 'present', 'correct'],
  },
  {
    guess: 'rainha',
    feedback: ['present', 'present', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'mancar',
    feedback: ['absent', 'present', 'absent', 'absent', 'present', 'present'],
  },
  {
    guess: 'ladroa',
    feedback: ['absent', 'present', 'present', 'correct', 'absent', 'correct'],
  },
  {
    guess: 'acerta',
    feedback: ['present', 'absent', 'absent', 'correct', 'absent', 'correct'],
  },
  {
    guess: 'pepita',
    feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'morena',
    feedback: ['absent', 'absent', 'present', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'fudida',
    feedback: ['absent', 'correct', 'absent', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'seboso',
    feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'larica',
    feedback: ['absent', 'present', 'present', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'quarta',
    feedback: ['absent', 'correct', 'correct', 'correct', 'absent', 'correct'],
  },
  {
    guess: 'passam',
    feedback: ['absent', 'present', 'absent', 'absent', 'present', 'absent'],
  },
  {
    guess: 'camada',
    feedback: ['absent', 'present', 'absent', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'tarada',
    feedback: ['absent', 'present', 'present', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'barata',
    feedback: ['absent', 'present', 'present', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'arfada',
    feedback: ['present', 'present', 'absent', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'parada',
    feedback: ['absent', 'present', 'present', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'ralada',
    feedback: ['present', 'present', 'absent', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'remada',
    feedback: ['present', 'absent', 'absent', 'present', 'correct', 'correct'],
  },
  {
    guess: 'virada',
    feedback: ['absent', 'absent', 'present', 'present', 'correct', 'correct'],
  },
  {
    guess: 'olinda',
    feedback: ['absent', 'absent', 'absent', 'absent', 'correct', 'correct'],
  },
];

// 2026-04-08 — "quando" — 6 jogadores, todos os guesses únicos do dia
const quandoDay: { guess: string; feedback: LetterFeedback[] }[] = [
  {
    guess: 'vintes',
    feedback: ['absent', 'present', 'present', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'piroca',
    feedback: ['absent', 'absent', 'absent', 'present', 'absent', 'present'],
  },
  {
    guess: 'macaco',
    feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'garoto',
    feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'lendas',
    feedback: ['absent', 'absent', 'present', 'present', 'present', 'absent'],
  },
  {
    guess: 'andado',
    feedback: ['present', 'present', 'absent', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'danado',
    feedback: ['absent', 'present', 'present', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'negado',
    feedback: ['present', 'absent', 'absent', 'present', 'correct', 'correct'],
  },
  {
    guess: 'brando',
    feedback: ['absent', 'absent', 'correct', 'correct', 'correct', 'correct'],
  },
  {
    guess: 'arreio',
    feedback: ['present', 'absent', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'canudo',
    feedback: ['absent', 'present', 'present', 'present', 'correct', 'correct'],
  },
  {
    guess: 'untado',
    feedback: ['present', 'present', 'absent', 'present', 'correct', 'correct'],
  },
  {
    guess: 'maluco',
    feedback: ['absent', 'present', 'absent', 'present', 'absent', 'correct'],
  },
  {
    guess: 'fração',
    feedback: ['absent', 'absent', 'correct', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'quanto',
    feedback: ['correct', 'correct', 'correct', 'correct', 'absent', 'correct'],
  },
  {
    guess: 'babaca',
    feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'coleta',
    feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'present'],
  },
  {
    guess: 'matriz',
    feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'drogas',
    feedback: ['present', 'absent', 'present', 'absent', 'present', 'absent'],
  },
  {
    guess: 'pratos',
    feedback: ['absent', 'absent', 'correct', 'absent', 'present', 'absent'],
  },
  {
    guess: 'coalho',
    feedback: ['absent', 'absent', 'correct', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'usados',
    feedback: ['present', 'absent', 'correct', 'present', 'present', 'absent'],
  },
  {
    guess: 'quadro',
    feedback: ['correct', 'correct', 'correct', 'present', 'absent', 'correct'],
  },
  {
    guess: 'alheio',
    feedback: ['present', 'absent', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'cavalo',
    feedback: ['absent', 'present', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'bueiro',
    feedback: ['absent', 'correct', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'cubado',
    feedback: ['absent', 'correct', 'absent', 'present', 'correct', 'correct'],
  },
  {
    guess: 'guardo',
    feedback: ['absent', 'correct', 'correct', 'absent', 'correct', 'correct'],
  },
];

// 2026-04-19 — "gaveta" — 6 jogadores, todos os guesses únicos do dia
const gavetaDay: { guess: string; feedback: LetterFeedback[] }[] = [
  {
    guess: 'reinam',
    feedback: ['absent', 'present', 'absent', 'absent', 'present', 'absent'],
  },
  {
    guess: 'poluir',
    feedback: ['absent', 'absent', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'cacete',
    feedback: ['absent', 'correct', 'absent', 'correct', 'correct', 'absent'],
  },
  {
    guess: 'gradil',
    feedback: ['correct', 'absent', 'present', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'escamo',
    feedback: ['present', 'absent', 'absent', 'present', 'absent', 'absent'],
  },
  {
    guess: 'nubank',
    feedback: ['absent', 'absent', 'absent', 'present', 'absent', 'absent'],
  },
  {
    guess: 'pateta',
    feedback: ['absent', 'correct', 'absent', 'correct', 'correct', 'correct'],
  },
  {
    guess: 'layout',
    feedback: ['absent', 'correct', 'absent', 'absent', 'absent', 'present'],
  },
  {
    guess: 'tapado',
    feedback: ['present', 'correct', 'absent', 'present', 'absent', 'absent'],
  },
  {
    guess: 'causar',
    feedback: ['absent', 'correct', 'absent', 'absent', 'present', 'absent'],
  },
  {
    guess: 'tarada',
    feedback: ['present', 'correct', 'absent', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'barata',
    feedback: ['absent', 'correct', 'absent', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'cativo',
    feedback: ['absent', 'correct', 'present', 'absent', 'present', 'absent'],
  },
  {
    guess: 'graves',
    feedback: ['correct', 'absent', 'present', 'present', 'present', 'absent'],
  },
  {
    guess: 'teriam',
    feedback: ['present', 'present', 'absent', 'absent', 'present', 'absent'],
  },
  {
    guess: 'vatapá',
    feedback: ['present', 'correct', 'present', 'absent', 'absent', 'correct'],
  },
  {
    guess: 'batata',
    feedback: ['absent', 'correct', 'absent', 'absent', 'correct', 'correct'],
  },
  {
    guess: 'radios',
    feedback: ['absent', 'correct', 'absent', 'absent', 'absent', 'absent'],
  },
  {
    guess: 'banque',
    feedback: ['absent', 'correct', 'absent', 'absent', 'absent', 'present'],
  },
  {
    guess: 'calhem',
    feedback: ['absent', 'correct', 'absent', 'absent', 'present', 'absent'],
  },
  {
    guess: 'glúten',
    feedback: ['correct', 'absent', 'absent', 'present', 'present', 'absent'],
  },
  {
    guess: 'galeto',
    feedback: ['correct', 'correct', 'absent', 'correct', 'correct', 'absent'],
  },
  {
    guess: 'gameta',
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
writeFileSync(
  join(OUT_DIR, 'termo-result.png'),
  await buildResultImage(guesses),
);
writeFileSync(
  join(OUT_DIR, 'termo-word-preview.png'),
  await buildWordPreviewImage('termos'),
);

writeFileSync(
  join(OUT_DIR, 'crossword-emojis.png'),
  await buildCrosswordImage(emojisDay, 'emojis'),
);
writeFileSync(
  join(OUT_DIR, 'crossword-layout.png'),
  await buildCrosswordImage(layoutDay, 'layout'),
);
writeFileSync(
  join(OUT_DIR, 'crossword-guarda.png'),
  await buildCrosswordImage(guardaDay, 'guarda'),
);
writeFileSync(
  join(OUT_DIR, 'crossword-quando.png'),
  await buildCrosswordImage(quandoDay, 'quando'),
);
writeFileSync(
  join(OUT_DIR, 'crossword-gaveta.png'),
  await buildCrosswordImage(gavetaDay, 'gaveta'),
);

console.log('done');
