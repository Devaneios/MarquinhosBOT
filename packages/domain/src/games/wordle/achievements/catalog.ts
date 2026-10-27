import type { achievementRaritySchema } from '@marquinhos/contracts/http/routes/gamification';
import type { WordlePatternPreview } from '@marquinhos/contracts/wordle';
import type { z } from 'zod';
import {
  getWordlePatternPreview,
  WORDLE_PATTERN_CATALOG,
  type WordlePatternFamily,
} from './patterns';
import type { WordleAchievementFamily, WordleAchievementRule } from './rules';

type AchievementRarity = z.infer<typeof achievementRaritySchema>;
export interface WordleAchievementDefinition {
  id: string;
  family: WordleAchievementFamily;
  tier: number;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  rewardXp: number;
  hidden: boolean;
  rule: WordleAchievementRule;
  patternPreview?: WordlePatternPreview;
}

export const WORDLE_ACHIEVEMENT_VERSION = 2;
const XP: Record<AchievementRarity, number> = {
  common: 25,
  rare: 75,
  epic: 150,
  legendary: 300,
};
const PATTERN_FAMILY: Record<WordlePatternFamily, WordleAchievementFamily> = {
  letter: 'letters',
  digit: 'digits',
  tetromino: 'tetrominoes',
  shape: 'shapes',
};
// Dense subsets make tetrominoes routine. Five-row glyphs and the larger shapes need more rows of evidence.
const PATTERN_RARITY: Record<WordlePatternFamily, AchievementRarity> = {
  letter: 'rare',
  digit: 'rare',
  tetromino: 'common',
  shape: 'rare',
};

function achievement(
  id: string,
  family: WordleAchievementFamily,
  name: string,
  description: string,
  rule: WordleAchievementRule,
  rarity: AchievementRarity = 'common',
  hidden = false,
  rewardXp = XP[rarity],
): WordleAchievementDefinition {
  return {
    id: `wordle_v2_${id}`,
    family,
    tier: 1,
    name,
    description,
    icon: family === 'letters' ? '🔤' : family === 'digits' ? '🔢' : '🏅',
    rarity,
    rewardXp,
    hidden,
    rule,
  };
}

const history: WordleAchievementDefinition[] = [
  ...([1, 10, 50, 100, 365] as const).map((count, i) =>
    achievement(
      `wins_${count}`,
      'wins',
      [
        'Palavra encontrada',
        'Dez respostas',
        'Cinquenta descobertas',
        'Cem soluções',
        'Ano de respostas',
      ][i]!,
      `Resolva a palavra diária em ${count} ${count === 1 ? 'data elegível' : 'datas elegíveis'}.`,
      { kind: 'wins', count },
      (['common', 'common', 'rare', 'epic', 'legendary'] as const)[i]!,
      false,
      count === 365 ? 750 : undefined,
    ),
  ),
  ...([1, 7, 30, 100, 365] as const).map((days, i) =>
    achievement(
      `played_${days}`,
      'played',
      [
        'Ponto de partida',
        'Sete encontros',
        'Trinta visitas',
        'Presença constante',
        'Um ano presente',
      ][i]!,
      `Envie ao menos um palpite válido em ${days} ${days === 1 ? 'data elegível' : 'datas elegíveis'}.`,
      { kind: 'played', days },
      (['common', 'common', 'rare', 'epic', 'legendary'] as const)[i]!,
      false,
      days === 365 ? 750 : undefined,
    ),
  ),
  ...([3, 7, 14, 30, 100] as const).map((days, i) =>
    achievement(
      `streak_${days}`,
      'streak',
      [
        'Trinca diária',
        'Sete acertos seguidos',
        'Duas semanas certas',
        'Mês de acertos',
        'Cem sem pausa',
      ][i]!,
      `Resolva em ${days} datas consecutivas desta coleção.`,
      { kind: 'streak', days },
      (['common', 'rare', 'rare', 'epic', 'legendary'] as const)[i]!,
    ),
  ),
  achievement(
    'played_streak_7',
    'participation_streak',
    'Toda semana',
    'Envie um palpite válido em 7 datas consecutivas, com ou sem vitória.',
    { kind: 'played_streak', days: 7 },
  ),
  achievement(
    'played_streak_30',
    'participation_streak',
    'Ritual diário',
    'Envie um palpite válido em 30 datas consecutivas, com ou sem vitória.',
    { kind: 'played_streak', days: 30 },
    'epic',
  ),
  achievement(
    'calendar_week',
    'calendar',
    'Agenda preenchida',
    'Jogue em todas as datas de uma semana já encerrada, de segunda a domingo.',
    { kind: 'calendar_coverage', period: 'week' },
    'rare',
  ),
  achievement(
    'calendar_month',
    'calendar',
    'Mês completo',
    'Jogue em todas as datas de um mês do calendário já encerrado.',
    { kind: 'calendar_coverage', period: 'month' },
    'epic',
  ),
  achievement(
    'solved_exactly_1',
    'precision',
    'Palpite certeiro',
    'Resolva na primeira tentativa.',
    { kind: 'solved_exactly', attempts: 1 },
    'rare',
  ),
  achievement(
    'solved_exactly_2',
    'precision',
    'Segunda é a certa',
    'Resolva em exatamente duas tentativas.',
    { kind: 'solved_exactly', attempts: 2 },
  ),
  achievement(
    'wins_within_3_10',
    'precision',
    'Mira treinada',
    'Resolva em até três tentativas em 10 datas elegíveis.',
    { kind: 'wins_within', maxAttempts: 3, count: 10 },
    'rare',
  ),
  achievement(
    'solved_after_10',
    'persistence',
    'Até encontrar',
    'Resolva depois de pelo menos 10 tentativas.',
    { kind: 'solved_after', minAttempts: 10 },
  ),
  achievement(
    'solved_after_20',
    'persistence',
    'Fôlego de sobra',
    'Resolva depois de pelo menos 20 tentativas.',
    { kind: 'solved_after', minAttempts: 20 },
    'rare',
  ),
  achievement(
    'all_yellow',
    'feedback',
    'Tudo no lugar errado',
    'Obtenha uma linha inteira amarela.',
    { kind: 'all_yellow_row' },
    'rare',
  ),
  achievement(
    'blank_opening',
    'feedback',
    'Recomeço em cinza',
    'Abra com uma linha toda cinza e depois resolva.',
    { kind: 'blank_start', maxAttempts: Number.MAX_SAFE_INTEGER },
  ),
  achievement(
    'mixed_rows',
    'feedback',
    'Três cores em sequência',
    'Faça três linhas consecutivas antes da solução, cada uma com verde, amarelo e cinza.',
    { kind: 'mixed_rows', count: 3 },
    'rare',
  ),
  achievement(
    'improvement',
    'style',
    'Passo a passo',
    'Resolva em pelo menos três tentativas, aumentando os verdes a cada palpite.',
    { kind: 'staircase', minAttempts: 3 },
    'rare',
  ),
  achievement(
    'near_miss',
    'style',
    'Faltava uma',
    'Resolva depois de uma linha com exatamente uma posição sem verde.',
    { kind: 'near_miss' },
  ),
  achievement(
    'secret_7c42a1e9',
    'comeback',
    'O dia seguinte existe',
    'Deixe uma partida com palpites terminar sem solução.',
    { kind: 'expired_unsolved' },
    'common',
    true,
  ),
  achievement(
    'secret_b83d2f06',
    'comeback',
    'De volta ao acerto',
    'Resolva na data imediatamente após uma partida expirada sem solução.',
    { kind: 'recovery' },
    'rare',
    true,
  ),
  achievement(
    'return_7',
    'comeback',
    'Bom te ver de novo',
    'Volte a jogar depois de pelo menos sete datas sem palpites elegíveis.',
    { kind: 'return_after_gap', days: 7 },
  ),
  achievement(
    'fast_60',
    'speed',
    'Minuto decisivo',
    'Resolva em até 60 segundos desde o primeiro palpite, com pelo menos duas tentativas.',
    { kind: 'fast_solve', seconds: 60, minAttempts: 2 },
    'rare',
  ),
  achievement(
    'secret_d6a09c31',
    'speed',
    'Meio minuto',
    'Resolva em até 30 segundos desde o primeiro palpite, com pelo menos duas tentativas.',
    { kind: 'fast_solve', seconds: 30, minAttempts: 2 },
    'epic',
    true,
  ),
  achievement(
    'secret_a14f8e52',
    'speed',
    'No seu tempo',
    'Resolva depois de pelo menos uma hora desde o primeiro palpite. O intervalo inclui pausas.',
    { kind: 'slow_solve', seconds: 3600 },
    'rare',
    true,
  ),
  achievement(
    'midnight',
    'timing',
    'Primeira hora',
    'Resolva entre 00h e 01h no fuso do jogo.',
    { kind: 'solved_at_hours', fromHour: 0, toHour: 1 },
  ),
  achievement(
    'morning',
    'timing',
    'Café com palavras',
    'Resolva entre 05h e 08h no fuso do jogo.',
    { kind: 'solved_at_hours', fromHour: 5, toHour: 8 },
  ),
  achievement(
    'late',
    'timing',
    'Antes de dormir',
    'Resolva entre 22h e meia-noite no fuso do jogo.',
    { kind: 'solved_at_hours', fromHour: 22, toHour: 24 },
  ),
  achievement(
    'first_solver_1',
    'timing',
    'Abriu os trabalhos',
    'Seja a primeira pessoa do servidor a resolver em uma data elegível.',
    { kind: 'first_solver', count: 1 },
  ),
  achievement(
    'first_solver_10',
    'timing',
    'Sempre chegando cedo',
    'Seja a primeira pessoa do servidor a resolver em 10 datas elegíveis.',
    { kind: 'first_solver', count: 10 },
    'rare',
  ),
  achievement(
    'both_lengths',
    'variety',
    'Cinco e seis',
    'Resolva palavras dos dois tamanhos, cinco e seis letras.',
    { kind: 'answer_lengths' },
    'rare',
  ),
  achievement(
    'attempts_1_to_6',
    'variety',
    'Todos os caminhos',
    'Resolva pelo menos uma vez com cada quantidade exata de tentativas de 1 a 6.',
    { kind: 'attempt_variety', maxAttempts: 6 },
    'epic',
  ),
  achievement(
    'repeated_letters',
    'vocabulary',
    'Letra em dobro',
    'Resolva uma resposta com letras repetidas depois de remover os acentos.',
    { kind: 'answer_vocabulary', feature: 'repeated_letters' },
  ),
  achievement(
    'accented_answer',
    'vocabulary',
    'Com acento',
    'Resolva uma resposta cuja grafia canônica tenha acento.',
    { kind: 'answer_vocabulary', feature: 'accent' },
  ),
];

const drawings = WORDLE_PATTERN_CATALOG.map((pattern) => ({
  ...achievement(
    `pattern_${pattern.id}`,
    PATTERN_FAMILY[pattern.family],
    pattern.name,
    `Forme ${pattern.name.toLowerCase()} com células verdes ou amarelas. Outras células não atrapalham.`,
    { kind: 'pattern', patternId: pattern.id },
    PATTERN_RARITY[pattern.family],
  ),
  patternPreview: getWordlePatternPreview(pattern.id),
}));
const collections: WordleAchievementDefinition[] = [
  achievement(
    'letters_5',
    'collections',
    'Primeiras letras',
    'Descubra cinco letras diferentes.',
    { kind: 'pattern_collection', family: 'letter', count: 5 },
    'rare',
  ),
  achievement(
    'letters_all',
    'collections',
    'Alfabeto completo',
    'Descubra as 26 letras do alfabeto.',
    { kind: 'pattern_collection', family: 'letter', count: 26 },
    'legendary',
    false,
    750,
  ),
  achievement(
    'digits_5',
    'collections',
    'Meia contagem',
    'Descubra cinco dígitos diferentes.',
    { kind: 'pattern_collection', family: 'digit', count: 5 },
    'rare',
  ),
  achievement(
    'digits_all',
    'collections',
    'De zero a nove',
    'Descubra os dez dígitos.',
    { kind: 'pattern_collection', family: 'digit', count: 10 },
    'epic',
  ),
  achievement(
    'tetrominoes_all',
    'collections',
    'Sete peças',
    'Descubra os sete tetraminós.',
    { kind: 'pattern_collection', family: 'tetromino', count: 7 },
    'rare',
  ),
  achievement(
    'shapes_5',
    'collections',
    'Caderno de desenhos',
    'Descubra cinco formas diferentes.',
    { kind: 'pattern_collection', family: 'shape', count: 5 },
    'rare',
  ),
  achievement(
    'shapes_all',
    'collections',
    'Galeria completa',
    'Descubra as dez formas.',
    { kind: 'pattern_collection', family: 'shape', count: 10 },
    'epic',
  ),
];
const tiers = new Map<WordleAchievementFamily, number>();
export const WORDLE_ACHIEVEMENT_CATALOG: readonly WordleAchievementDefinition[] =
  [...history, ...drawings, ...collections].map((definition) => {
    const tier = (tiers.get(definition.family) ?? 0) + 1;
    tiers.set(definition.family, tier);
    return { ...definition, tier };
  });
