import type { AchievementSpec } from '../types';

export const COLLECTIONS = [
  {
    id: 'wordle_v2_letters_5',
    family: 'collections',
    name: 'Primeiras letras',
    description: 'Descubra cinco letras diferentes.',
    rarity: 'rare',
    rule: {
      kind: 'pattern_collection',
      family: 'letter',
      count: 5,
    },
  },
  {
    id: 'wordle_v2_letters_all',
    family: 'collections',
    name: 'Alfabeto completo',
    description: 'Descubra as 26 letras do alfabeto.',
    rarity: 'legendary',
    rewardXp: 750,
    rule: {
      kind: 'pattern_collection',
      family: 'letter',
      count: 26,
    },
  },
  {
    id: 'wordle_v2_digits_5',
    family: 'collections',
    name: 'Meia contagem',
    description: 'Descubra cinco dígitos diferentes.',
    rarity: 'rare',
    rule: {
      kind: 'pattern_collection',
      family: 'digit',
      count: 5,
    },
  },
  {
    id: 'wordle_v2_digits_all',
    family: 'collections',
    name: 'De zero a nove',
    description: 'Descubra os dez dígitos.',
    rarity: 'epic',
    rule: {
      kind: 'pattern_collection',
      family: 'digit',
      count: 10,
    },
  },
  {
    id: 'wordle_v2_tetrominoes_all',
    family: 'collections',
    name: 'Sete peças',
    description: 'Descubra os sete tetraminós.',
    rarity: 'rare',
    rule: {
      kind: 'pattern_collection',
      family: 'tetromino',
      count: 7,
    },
  },
  {
    id: 'wordle_v2_shapes_5',
    family: 'collections',
    name: 'Caderno de desenhos',
    description: 'Descubra cinco formas diferentes.',
    rarity: 'rare',
    rule: {
      kind: 'pattern_collection',
      family: 'shape',
      count: 5,
    },
  },
  {
    id: 'wordle_v2_shapes_all',
    family: 'collections',
    name: 'Galeria completa',
    description: 'Descubra as dez formas.',
    rarity: 'epic',
    rule: {
      kind: 'pattern_collection',
      family: 'shape',
      count: 10,
    },
  },
] satisfies readonly AchievementSpec[];
