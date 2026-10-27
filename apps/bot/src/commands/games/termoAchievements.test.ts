import type { WordleAchievementsOverview } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import sharp from 'sharp';
import { buildTermoAchievementsReply } from './termoAchievements';
import { buildTermoActionRow, TERMO_BUTTON_IDS } from './termoResponse';

const overview: WordleAchievementsOverview = {
  achievementVersion: 1,
  achievements: [
    {
      id: 'wordle_first_win',
      name: 'Primeira palavra',
      description: 'Acerte sua primeira palavra diária.',
      icon: '🎯',
      rarity: 'common',
      rewardXp: 25,
      family: 'wins',
      tier: 1,
      hidden: false,
      unlockedAt: '2026-10-01T12:00:00.000Z',
      progress: { current: 1, target: 1 },
      holdersPercent: 40,
    },
  ],
  stats: {
    played: 3,
    wins: 1,
    winRate: 33,
    currentStreak: 0,
    bestStreak: 1,
    distribution: [0, 0, 1, 0, 0, 0, 0],
  },
};

describe('buildTermoAchievementsReply', () => {
  it('fetches the target overview and returns an embed with its card', async () => {
    const calls: [string, string][] = [];
    const reply = await buildTermoAchievementsReply(
      { user: null },
      'guild-1',
      { id: 'user-1', displayName: 'Ana', avatarUrl: 'https://cdn/ana.png' },
      {
        getWordleAchievements: async (userId: string, guildId: string) => {
          calls.push([userId, guildId]);
          return { data: overview };
        },
      } as never,
    );

    expect(calls).toEqual([['user-1', 'guild-1']]);
    expect(reply.embeds).toHaveLength(1);
    expect(reply.files).toHaveLength(1);
    const embed = reply.embeds[0]!.toJSON();
    expect(embed.image?.url).toBe('attachment://termo-conquistas-user-1.png');
    const meta = await sharp(reply.files[0]!.attachment as Buffer).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(480);
  });

  it('propagates API failures to the caller', async () => {
    await expect(
      buildTermoAchievementsReply(
        { user: null },
        'guild-1',
        { id: 'user-1', displayName: 'Ana', avatarUrl: '' },
        {
          getWordleAchievements: async () => {
            throw new Error('api down');
          },
        } as never,
      ),
    ).rejects.toThrow('api down');
  });

  it('selects a drawing by name and renders its preview instead of the overview', async () => {
    const reply = await buildTermoAchievementsReply(
      { user: null },
      'guild-1',
      { id: 'user-1', displayName: 'Ana', avatarUrl: 'https://cdn/ana.png' },
      {
        getWordleAchievements: async () => ({
          data: {
            ...overview,
            achievements: [
              {
                ...overview.achievements[0]!,
                id: 'wordle_v2_letter_t',
                name: 'Letra T',
                unlockedAt: null,
                patternPreview: {
                  patternId: 'letter_t',
                  mask: ['###', '.#.', '.#.'],
                  colors: ['correct', 'present'],
                  rotations: [0],
                },
              },
            ],
          },
        }),
      } as never,
      'letra t',
    );
    expect(reply.embeds[0]!.toJSON().title).toContain('Letra T');
    expect(reply.embeds[0]!.toJSON().description).not.toContain(
      'desbloqueadas',
    );
    expect(reply.files).toHaveLength(1);
    expect(
      (await sharp(reply.files[0]!.attachment as Buffer).metadata()).width,
    ).toBe(480);
  });

  it('returns selection guidance when the requested achievement is missing', async () => {
    const reply = await buildTermoAchievementsReply(
      { user: null },
      'guild-1',
      { id: 'user-1', displayName: 'Ana', avatarUrl: 'https://cdn/ana.png' },
      { getWordleAchievements: async () => ({ data: overview }) } as never,
      'missing',
    );
    expect(reply.embeds[0]!.toJSON().description).toContain('Nome ou ID');
    expect(reply.files).toHaveLength(0);
  });

  it('selects an earned drawing by ID and includes its saved match', async () => {
    const reply = await buildTermoAchievementsReply(
      { user: null },
      'guild-1',
      { id: 'user-1', displayName: 'Ana', avatarUrl: 'https://cdn/ana.png' },
      {
        getWordleAchievements: async () => ({
          data: {
            ...overview,
            achievements: [
              {
                ...overview.achievements[0]!,
                matchEvidence: {
                  patternId: 'tetromino_i',
                  color: 'correct',
                  origin: [0, 0],
                  rotation: 0,
                  cells: [
                    [0, 0],
                    [0, 1],
                    [0, 2],
                    [0, 3],
                  ],
                  feedback: [
                    ['correct', 'correct', 'correct', 'correct', 'correct'],
                  ],
                  date: '2026-10-01',
                },
              },
            ],
          },
        }),
      } as never,
      'wordle_first_win',
    );
    expect(
      reply.embeds[0]!.toJSON().fields?.find(
        (field) => field.name === 'Desenho encontrado',
      )?.value,
    ).toContain('2026-10-01');
    expect(reply.files).toHaveLength(1);
  });

  it('does not attach a locked secret preview or reveal its name', async () => {
    const reply = await buildTermoAchievementsReply(
      { user: null },
      'guild-1',
      { id: 'user-1', displayName: 'Ana', avatarUrl: 'https://cdn/ana.png' },
      {
        getWordleAchievements: async () => ({
          data: {
            ...overview,
            achievements: [
              {
                ...overview.achievements[0]!,
                hidden: true,
                unlockedAt: null,
                patternPreview: {
                  patternId: 'letter_t',
                  mask: ['###', '.#.', '.#.'],
                  colors: ['correct', 'present'],
                  rotations: [0],
                },
              },
            ],
          },
        }),
      } as never,
      'wordle_first_win',
    );
    expect(reply.files).toHaveLength(0);
    expect(JSON.stringify(reply.embeds[0]!.toJSON())).not.toContain(
      'Primeira palavra',
    );
  });
});

describe('buildTermoActionRow', () => {
  it('offers the achievements button next to the existing actions', () => {
    const ids = buildTermoActionRow()
      .toJSON()
      .components.map((c) => ('custom_id' in c ? c.custom_id : null));
    expect(ids).toEqual([
      TERMO_BUTTON_IDS.text,
      TERMO_BUTTON_IDS.retry,
      TERMO_BUTTON_IDS.link,
      TERMO_BUTTON_IDS.achievements,
    ]);
  });
});
