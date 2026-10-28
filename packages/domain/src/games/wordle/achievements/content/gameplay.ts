import type { AchievementSpec } from '../types';

export const GAMEPLAY = [
  {
    id: 'wordle_v2_played_streak_7',
    family: 'participation_streak',
    name: 'Toda semana',
    description:
      'Envie um palpite válido em 7 datas consecutivas, com ou sem vitória.',
    rarity: 'common',
    rule: {
      kind: 'played_streak',
      days: 7,
    },
  },
  {
    id: 'wordle_v2_played_streak_30',
    family: 'participation_streak',
    name: 'Ritual diário',
    description:
      'Envie um palpite válido em 30 datas consecutivas, com ou sem vitória.',
    rarity: 'epic',
    rule: {
      kind: 'played_streak',
      days: 30,
    },
  },
  {
    id: 'wordle_v2_calendar_week',
    family: 'calendar',
    name: 'Agenda preenchida',
    description:
      'Jogue em todas as datas de uma semana já encerrada, de segunda a domingo.',
    rarity: 'rare',
    rule: {
      kind: 'calendar_coverage',
      period: 'week',
    },
  },
  {
    id: 'wordle_v2_calendar_month',
    family: 'calendar',
    name: 'Mês completo',
    description:
      'Jogue em todas as datas de um mês do calendário já encerrado.',
    rarity: 'epic',
    rule: {
      kind: 'calendar_coverage',
      period: 'month',
    },
  },
  {
    id: 'wordle_v2_solved_exactly_1',
    family: 'precision',
    name: 'Palpite certeiro',
    description: 'Resolva na primeira tentativa.',
    rarity: 'rare',
    rule: {
      kind: 'solved_exactly',
      attempts: 1,
    },
  },
  {
    id: 'wordle_v2_solved_exactly_2',
    family: 'precision',
    name: 'Segunda é a certa',
    description: 'Resolva em exatamente duas tentativas.',
    rarity: 'common',
    rule: {
      kind: 'solved_exactly',
      attempts: 2,
    },
  },
  {
    id: 'wordle_v2_wins_within_3_10',
    family: 'precision',
    name: 'Mira treinada',
    description: 'Resolva em até três tentativas em 10 datas elegíveis.',
    rarity: 'rare',
    rule: {
      kind: 'wins_within',
      maxAttempts: 3,
      count: 10,
    },
  },
  {
    id: 'wordle_v2_solved_after_10',
    family: 'persistence',
    name: 'Até encontrar',
    description: 'Resolva depois de pelo menos 10 tentativas.',
    rarity: 'common',
    rule: {
      kind: 'solved_after',
      minAttempts: 10,
    },
  },
  {
    id: 'wordle_v2_solved_after_20',
    family: 'persistence',
    name: 'Fôlego de sobra',
    description: 'Resolva depois de pelo menos 20 tentativas.',
    rarity: 'rare',
    rule: {
      kind: 'solved_after',
      minAttempts: 20,
    },
  },
  {
    id: 'wordle_v2_all_yellow',
    family: 'feedback',
    name: 'Tudo no lugar errado',
    description: 'Obtenha uma linha inteira amarela.',
    rarity: 'rare',
    rule: {
      kind: 'all_yellow_row',
    },
  },
  {
    id: 'wordle_v2_blank_opening',
    family: 'feedback',
    name: 'Recomeço em cinza',
    description: 'Abra com uma linha toda cinza e depois resolva.',
    rarity: 'common',
    rule: {
      kind: 'blank_start',
      maxAttempts: Number.MAX_SAFE_INTEGER,
    },
  },
  {
    id: 'wordle_v2_mixed_rows',
    family: 'feedback',
    name: 'Três cores em sequência',
    description:
      'Faça três linhas consecutivas antes da solução, cada uma com verde, amarelo e cinza.',
    rarity: 'rare',
    rule: {
      kind: 'mixed_rows',
      count: 3,
    },
  },
  {
    id: 'wordle_v2_improvement',
    family: 'style',
    name: 'Passo a passo',
    description:
      'Resolva em pelo menos três tentativas, aumentando os verdes a cada palpite.',
    rarity: 'rare',
    rule: {
      kind: 'staircase',
      minAttempts: 3,
    },
  },
  {
    id: 'wordle_v2_near_miss',
    family: 'style',
    name: 'Faltava uma',
    description:
      'Resolva depois de uma linha com exatamente uma posição sem verde.',
    rarity: 'common',
    rule: {
      kind: 'near_miss',
    },
  },
  {
    id: 'wordle_v2_secret_7c42a1e9',
    family: 'comeback',
    name: 'O dia seguinte existe',
    description: 'Deixe uma partida com palpites terminar sem solução.',
    rarity: 'common',
    hidden: true,
    rule: {
      kind: 'expired_unsolved',
    },
  },
  {
    id: 'wordle_v2_secret_b83d2f06',
    family: 'comeback',
    name: 'De volta ao acerto',
    description:
      'Resolva na data imediatamente após uma partida expirada sem solução.',
    rarity: 'rare',
    hidden: true,
    rule: {
      kind: 'recovery',
    },
  },
  {
    id: 'wordle_v2_return_7',
    family: 'comeback',
    name: 'Bom te ver de novo',
    description:
      'Volte a jogar depois de pelo menos sete datas sem palpites elegíveis.',
    rarity: 'common',
    rule: {
      kind: 'return_after_gap',
      days: 7,
    },
  },
  {
    id: 'wordle_v2_fast_60',
    family: 'speed',
    name: 'Minuto decisivo',
    description:
      'Resolva em até 60 segundos desde o primeiro palpite, com pelo menos duas tentativas.',
    rarity: 'rare',
    rule: {
      kind: 'fast_solve',
      seconds: 60,
      minAttempts: 2,
    },
  },
  {
    id: 'wordle_v2_secret_d6a09c31',
    family: 'speed',
    name: 'Meio minuto',
    description:
      'Resolva em até 30 segundos desde o primeiro palpite, com pelo menos duas tentativas.',
    rarity: 'epic',
    hidden: true,
    rule: {
      kind: 'fast_solve',
      seconds: 30,
      minAttempts: 2,
    },
  },
  {
    id: 'wordle_v2_secret_a14f8e52',
    family: 'speed',
    name: 'No seu tempo',
    description:
      'Resolva depois de pelo menos uma hora desde o primeiro palpite. O intervalo inclui pausas.',
    rarity: 'rare',
    hidden: true,
    rule: {
      kind: 'slow_solve',
      seconds: 3600,
    },
  },
  {
    id: 'wordle_v2_midnight',
    family: 'timing',
    name: 'Primeira hora',
    description: 'Resolva entre 00h e 01h no fuso do jogo.',
    rarity: 'common',
    rule: {
      kind: 'solved_at_hours',
      fromHour: 0,
      toHour: 1,
    },
  },
  {
    id: 'wordle_v2_morning',
    family: 'timing',
    name: 'Café com palavras',
    description: 'Resolva entre 05h e 08h no fuso do jogo.',
    rarity: 'common',
    rule: {
      kind: 'solved_at_hours',
      fromHour: 5,
      toHour: 8,
    },
  },
  {
    id: 'wordle_v2_late',
    family: 'timing',
    name: 'Antes de dormir',
    description: 'Resolva entre 22h e meia-noite no fuso do jogo.',
    rarity: 'common',
    rule: {
      kind: 'solved_at_hours',
      fromHour: 22,
      toHour: 24,
    },
  },
  {
    id: 'wordle_v2_first_solver_1',
    family: 'timing',
    name: 'Abriu os trabalhos',
    description:
      'Seja a primeira pessoa do servidor a resolver em uma data elegível.',
    rarity: 'common',
    rule: {
      kind: 'first_solver',
      count: 1,
    },
  },
  {
    id: 'wordle_v2_first_solver_10',
    family: 'timing',
    name: 'Sempre chegando cedo',
    description:
      'Seja a primeira pessoa do servidor a resolver em 10 datas elegíveis.',
    rarity: 'rare',
    rule: {
      kind: 'first_solver',
      count: 10,
    },
  },
  {
    id: 'wordle_v2_both_lengths',
    family: 'variety',
    name: 'Cinco e seis',
    description: 'Resolva palavras dos dois tamanhos, cinco e seis letras.',
    rarity: 'rare',
    rule: {
      kind: 'answer_lengths',
    },
  },
  {
    id: 'wordle_v2_attempts_1_to_6',
    family: 'variety',
    name: 'Todos os caminhos',
    description:
      'Resolva pelo menos uma vez com cada quantidade exata de tentativas de 1 a 6.',
    rarity: 'epic',
    rule: {
      kind: 'attempt_variety',
      maxAttempts: 6,
    },
  },
  {
    id: 'wordle_v2_repeated_letters',
    family: 'vocabulary',
    name: 'Letra em dobro',
    description:
      'Resolva uma resposta com letras repetidas depois de remover os acentos.',
    rarity: 'common',
    rule: {
      kind: 'answer_vocabulary',
      feature: 'repeated_letters',
    },
  },
  {
    id: 'wordle_v2_accented_answer',
    family: 'vocabulary',
    name: 'Com acento',
    description: 'Resolva uma resposta cuja grafia canônica tenha acento.',
    rarity: 'common',
    rule: {
      kind: 'answer_vocabulary',
      feature: 'accent',
    },
  },
] satisfies readonly AchievementSpec[];
