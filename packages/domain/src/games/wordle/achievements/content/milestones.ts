import type { AchievementSpec } from '../types';

export const MILESTONES = [
  {
    id: 'wordle_v2_wins_1',
    family: 'wins',
    name: 'Palavra encontrada',
    description: 'Resolva a palavra diária em 1 data elegível.',
    rarity: 'common',
    rule: {
      kind: 'wins',
      count: 1,
    },
  },
  {
    id: 'wordle_v2_wins_10',
    family: 'wins',
    name: 'Dez respostas',
    description: 'Resolva a palavra diária em 10 datas elegíveis.',
    rarity: 'common',
    rule: {
      kind: 'wins',
      count: 10,
    },
  },
  {
    id: 'wordle_v2_wins_50',
    family: 'wins',
    name: 'Cinquenta descobertas',
    description: 'Resolva a palavra diária em 50 datas elegíveis.',
    rarity: 'rare',
    rule: {
      kind: 'wins',
      count: 50,
    },
  },
  {
    id: 'wordle_v2_wins_100',
    family: 'wins',
    name: 'Cem soluções',
    description: 'Resolva a palavra diária em 100 datas elegíveis.',
    rarity: 'epic',
    rule: {
      kind: 'wins',
      count: 100,
    },
  },
  {
    id: 'wordle_v2_wins_365',
    family: 'wins',
    name: 'Ano de respostas',
    description: 'Resolva a palavra diária em 365 datas elegíveis.',
    rarity: 'legendary',
    rewardXp: 750,
    rule: {
      kind: 'wins',
      count: 365,
    },
  },
  {
    id: 'wordle_v2_played_1',
    family: 'played',
    name: 'Ponto de partida',
    description: 'Envie ao menos um palpite válido em 1 data elegível.',
    rarity: 'common',
    rule: {
      kind: 'played',
      days: 1,
    },
  },
  {
    id: 'wordle_v2_played_7',
    family: 'played',
    name: 'Sete encontros',
    description: 'Envie ao menos um palpite válido em 7 datas elegíveis.',
    rarity: 'common',
    rule: {
      kind: 'played',
      days: 7,
    },
  },
  {
    id: 'wordle_v2_played_30',
    family: 'played',
    name: 'Trinta visitas',
    description: 'Envie ao menos um palpite válido em 30 datas elegíveis.',
    rarity: 'rare',
    rule: {
      kind: 'played',
      days: 30,
    },
  },
  {
    id: 'wordle_v2_played_100',
    family: 'played',
    name: 'Presença constante',
    description: 'Envie ao menos um palpite válido em 100 datas elegíveis.',
    rarity: 'epic',
    rule: {
      kind: 'played',
      days: 100,
    },
  },
  {
    id: 'wordle_v2_played_365',
    family: 'played',
    name: 'Um ano presente',
    description: 'Envie ao menos um palpite válido em 365 datas elegíveis.',
    rarity: 'legendary',
    rewardXp: 750,
    rule: {
      kind: 'played',
      days: 365,
    },
  },
  {
    id: 'wordle_v2_streak_3',
    family: 'streak',
    name: 'Trinca diária',
    description: 'Resolva em 3 datas consecutivas desta coleção.',
    rarity: 'common',
    rule: {
      kind: 'streak',
      days: 3,
    },
  },
  {
    id: 'wordle_v2_streak_7',
    family: 'streak',
    name: 'Sete acertos seguidos',
    description: 'Resolva em 7 datas consecutivas desta coleção.',
    rarity: 'rare',
    rule: {
      kind: 'streak',
      days: 7,
    },
  },
  {
    id: 'wordle_v2_streak_14',
    family: 'streak',
    name: 'Duas semanas certas',
    description: 'Resolva em 14 datas consecutivas desta coleção.',
    rarity: 'rare',
    rule: {
      kind: 'streak',
      days: 14,
    },
  },
  {
    id: 'wordle_v2_streak_30',
    family: 'streak',
    name: 'Mês de acertos',
    description: 'Resolva em 30 datas consecutivas desta coleção.',
    rarity: 'epic',
    rule: {
      kind: 'streak',
      days: 30,
    },
  },
  {
    id: 'wordle_v2_streak_100',
    family: 'streak',
    name: 'Cem sem pausa',
    description: 'Resolva em 100 datas consecutivas desta coleção.',
    rarity: 'legendary',
    rule: {
      kind: 'streak',
      days: 100,
    },
  },
] satisfies readonly AchievementSpec[];
