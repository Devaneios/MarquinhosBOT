import type {
  WordleAchievementStatus,
  WordleAchievementsOverview,
} from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import {
  buildTermoAchievementDetailEmbed,
  buildTermoAchievementsEmbed,
  familyLabel,
  summarizeTermoAchievements,
  textProgressBar,
} from './termoAchievements';

function status(
  overrides: Partial<WordleAchievementStatus> & { id: string },
): WordleAchievementStatus {
  return {
    name: overrides.id,
    description: 'desc',
    icon: '🎯',
    rarity: 'common',
    rewardXp: 50,
    family: 'wins',
    tier: 1,
    hidden: false,
    unlockedAt: null,
    progress: null,
    holdersPercent: null,
    ...overrides,
  };
}

const achievements: WordleAchievementStatus[] = [
  status({
    id: 'wordle_first_win',
    name: 'Primeira palavra',
    unlockedAt: '2026-10-01T12:00:00.000Z',
    rewardXp: 25,
    holdersPercent: 62.4,
  }),
  status({
    id: 'wordle_wins_10',
    name: 'Dez palavras',
    tier: 2,
    progress: { current: 8, target: 10 },
    rewardXp: 100,
  }),
  status({
    id: 'wordle_streak_3',
    family: 'streak',
    name: 'No ritmo',
    unlockedAt: '2026-10-20T12:00:00.000Z',
  }),
  status({
    id: 'wordle_streak_7',
    family: 'streak',
    tier: 2,
    name: 'Semana perfeita',
    progress: { current: 3, target: 7 },
  }),
  status({
    id: 'wordle_played_10',
    family: 'played',
    name: 'Presença marcada',
    progress: { current: 0, target: 10 },
  }),
  status({
    id: 'wordle_night_owl',
    family: 'timing',
    name: '',
    description: '',
    icon: '❔',
    hidden: true,
  }),
  status({
    id: 'wordle_staircase',
    family: 'style',
    name: 'Escada perfeita',
    hidden: true,
    unlockedAt: '2026-10-10T12:00:00.000Z',
    rewardXp: 200,
  }),
  status({ id: 'custom_family', family: 'zzz_custom', name: 'Custom' }),
];

describe('summarizeTermoAchievements', () => {
  const summary = summarizeTermoAchievements(achievements);

  it('counts unlocked badges and earned XP', () => {
    expect(summary.unlocked).toBe(3);
    expect(summary.total).toBe(8);
    expect(summary.earnedXp).toBe(25 + 50 + 200);
  });

  it('counts only locked secrets', () => {
    expect(summary.lockedSecrets).toBe(1);
  });

  it('orders families canonically with unknown ones last', () => {
    expect(summary.families.map((f) => f.family)).toEqual([
      'wins',
      'streak',
      'played',
      'timing',
      'style',
      'zzz_custom',
    ]);
    expect(summary.families[0]).toEqual({
      family: 'wins',
      label: 'Vitórias',
      unlocked: 1,
      total: 2,
    });
  });

  it('lists recent unlocks newest first', () => {
    expect(summary.recent.map((a) => a.id)).toEqual([
      'wordle_streak_3',
      'wordle_staircase',
      'wordle_first_win',
    ]);
  });

  it('suggests started, visible goals closest to completion', () => {
    expect(summary.nextGoals.map((a) => a.id)).toEqual([
      'wordle_wins_10',
      'wordle_streak_7',
    ]);
  });
});

describe('textProgressBar', () => {
  it('fills proportionally and clamps', () => {
    expect(textProgressBar(0, 10)).toBe('▱▱▱▱▱▱▱▱▱▱');
    expect(textProgressBar(8, 10)).toBe('▰▰▰▰▰▰▰▰▱▱');
    expect(textProgressBar(15, 10)).toBe('▰▰▰▰▰▰▰▰▰▰');
    expect(textProgressBar(1, 0)).toBe('▱▱▱▱▱▱▱▱▱▱');
  });
});

describe('familyLabel', () => {
  it('falls back to the raw family slug', () => {
    expect(familyLabel('speed')).toBe('Velocidade');
    expect(familyLabel('novidade')).toBe('novidade');
  });
  it('labels drawing families in Portuguese', () => {
    expect(
      ['letters', 'digits', 'tetrominoes', 'shapes', 'collections'].map(
        familyLabel,
      ),
    ).toEqual(['Letras', 'Dígitos', 'Tetraminós', 'Formas', 'Coleções']);
  });
});

describe('buildTermoAchievementsEmbed', () => {
  const client = { user: { displayAvatarURL: () => 'https://bot/avatar.png' } };
  const target = { displayName: 'Ana', avatarUrl: 'https://cdn/ana.png' };
  const overview: WordleAchievementsOverview = {
    achievementVersion: 1,
    achievements,
    stats: {
      played: 12,
      wins: 10,
      winRate: 83,
      currentStreak: 3,
      bestStreak: 4,
      distribution: [0, 1, 4, 3, 1, 1, 0],
    },
  };

  it('renders summary, recent unlocks, goals, secrets and the image', () => {
    const json = buildTermoAchievementsEmbed(
      client,
      target,
      overview,
      'card.png',
    ).toJSON();
    expect(json.title).toBe('🏆 Conquistas do Terminhos · Ana');
    expect(json.description).toBe('**3/8** desbloqueadas · **275 XP** ganhos');
    expect(json.image?.url).toBe('attachment://card.png');
    const fields = Object.fromEntries(
      (json.fields ?? []).map((f) => [f.name, f.value]),
    );
    expect(fields['Desbloqueadas recentemente']).toContain(
      '🎯 **Primeira palavra** · <t:1790856000:R> · 62% do servidor',
    );
    expect(fields['Próximas metas']).toContain('▰▰▰▰▰▰▰▰▱▱ 8/10 · +100 XP');
    expect(fields['🔒 Secretas']).toBe(
      'Ainda existe 1 conquista secreta para descobrir.',
    );
  });

  it('never leaks a locked secret into the text', () => {
    const json = JSON.stringify(
      buildTermoAchievementsEmbed(client, target, overview).toJSON(),
    );
    expect(json).not.toContain('❔');
  });

  it('invites newcomers to play instead of listing nothing', () => {
    const json = buildTermoAchievementsEmbed(client, target, {
      ...overview,
      achievements: achievements.map((a) => ({
        ...a,
        unlockedAt: null,
        progress: null,
      })),
    }).toJSON();
    expect(json.fields?.[0]?.value).toContain('/termo');
    expect(json.fields?.some((f) => f.name === 'Próximas metas')).toBe(false);
  });
});

describe('buildTermoAchievementDetailEmbed', () => {
  const client = { user: null };
  const target = { displayName: 'Ana', avatarUrl: 'https://cdn/ana.png' };
  const drawing = status({
    id: 'wordle_v2_letter_t',
    name: 'Letra T',
    family: 'letters',
    description: 'Desenhe a letra T.',
    patternPreview: {
      patternId: 'letter_t',
      mask: ['###', '.#.', '.#.'],
      colors: ['correct', 'present'],
      rotations: [0],
    },
  });

  it('explains both colors, wildcard cells, and the winning row', () => {
    const json = buildTermoAchievementDetailEmbed(
      client,
      target,
      drawing,
      'detail.png',
    ).toJSON();
    expect(json.title).toContain('Letra T');
    expect(json.description).toContain('Desenhe a letra T.');
    const text = JSON.stringify(json);
    expect(text).toContain('verde ou amarelo');
    expect(text).toContain('isolado');
    expect(text).toContain('linha da vitória');
    expect(json.image?.url).toBe('attachment://detail.png');
  });

  it('keeps hidden locked metadata private', () => {
    const json = buildTermoAchievementDetailEmbed(client, target, {
      ...drawing,
      hidden: true,
    }).toJSON();
    expect(JSON.stringify(json)).not.toContain('Letra T');
    expect(JSON.stringify(json)).not.toContain('Desenhe');
    expect(json.title).toContain('Conquista secreta');
  });
});
