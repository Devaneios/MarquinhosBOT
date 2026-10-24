import type { Achievement } from './types';

type WordleAchievementDefinition = Omit<Achievement, 'condition'> & {
  condition: {
    type:
      'wordle_wins' | 'wordle_streak' | 'wordle_solved_in' | 'wordle_played';
    threshold: number;
  };
};

export const WORDLE_ACHIEVEMENTS = [
  {
    id: 'wordle_first_win',
    name: 'Primeira palavra',
    description: 'Acerte sua primeira palavra diária.',
    category: 'wordle',
    rarity: 'common',
    icon: '🎯',
    condition: { type: 'wordle_wins', threshold: 1 },
    reward_xp: 25,
  },
  {
    id: 'wordle_wins_10',
    name: 'Dez palavras',
    description: 'Acerte a palavra diária em 10 dias.',
    category: 'wordle',
    rarity: 'rare',
    icon: '📚',
    condition: { type: 'wordle_wins', threshold: 10 },
    reward_xp: 100,
  },
  {
    id: 'wordle_wins_50',
    name: 'Cinquenta palavras',
    description: 'Acerte a palavra diária em 50 dias.',
    category: 'wordle',
    rarity: 'epic',
    icon: '🏆',
    condition: { type: 'wordle_wins', threshold: 50 },
    reward_xp: 300,
  },
  {
    id: 'wordle_streak_3',
    name: 'No ritmo',
    description: 'Acerte a palavra diária por 3 dias seguidos.',
    category: 'wordle',
    rarity: 'common',
    icon: '🔥',
    condition: { type: 'wordle_streak', threshold: 3 },
    reward_xp: 50,
  },
  {
    id: 'wordle_streak_7',
    name: 'Semana perfeita',
    description: 'Acerte a palavra diária por 7 dias seguidos.',
    category: 'wordle',
    rarity: 'rare',
    icon: '📅',
    condition: { type: 'wordle_streak', threshold: 7 },
    reward_xp: 150,
  },
  {
    id: 'wordle_streak_30',
    name: 'Palavra todo dia',
    description: 'Acerte a palavra diária por 30 dias seguidos.',
    category: 'wordle',
    rarity: 'legendary',
    icon: '👑',
    condition: { type: 'wordle_streak', threshold: 30 },
    reward_xp: 500,
  },
  {
    id: 'wordle_solved_in_1',
    name: 'Na mosca',
    description: 'Acerte uma palavra diária na primeira tentativa.',
    category: 'wordle',
    rarity: 'epic',
    icon: '🍀',
    condition: { type: 'wordle_solved_in', threshold: 1 },
    reward_xp: 100,
  },
  {
    id: 'wordle_solved_in_2',
    name: 'Quase de primeira',
    description: 'Acerte uma palavra diária em até 2 tentativas.',
    category: 'wordle',
    rarity: 'rare',
    icon: '⚡',
    condition: { type: 'wordle_solved_in', threshold: 2 },
    reward_xp: 50,
  },
  {
    id: 'wordle_played_10',
    name: 'Presença marcada',
    description: 'Jogue a palavra diária em 10 dias diferentes.',
    category: 'wordle',
    rarity: 'common',
    icon: '✍️',
    condition: { type: 'wordle_played', threshold: 10 },
    reward_xp: 50,
  },
] satisfies WordleAchievementDefinition[];
