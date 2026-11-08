import { describe, expect, it } from 'bun:test';
import { WordlePlayerOverviewService } from 'modules/wordle/services/wordle-player-overview.service';
import { WordleRewardsService } from 'modules/wordle/services/wordle-rewards.service';
import { WordleShowcaseService } from 'modules/wordle/services/wordle-showcase.service';
import { WordleService } from 'modules/wordle/wordle.service';

const userId = 'user-1';
const guildId = 'guild-1';
const evidence = (date: string) => ({
  patternId: 'pattern-1',
  color: 'correct' as const,
  origin: [0, 0] as [number, number],
  rotation: 0 as const,
  cells: [[0, 0] as [number, number]],
  feedback: [['correct' as const]],
  date,
});

function makeService(options: {
  overview?: unknown;
  cosmetics?: unknown;
  showcase?: string[];
  today?: string;
  calls?: string[];
}) {
  const calls = options.calls ?? [];
  const wordle = {
    getAchievementsOverview: async (
      requestedUserId: string,
      requestedGuildId: string,
      viewerId: string,
    ) => {
      calls.push(`overview:${requestedUserId}:${requestedGuildId}:${viewerId}`);
      return options.overview;
    },
  } as unknown as WordleService;
  const rewards = {
    reconcile: async (requestedUserId: string) => {
      calls.push(`reconcile:${requestedUserId}`);
    },
    get: async (requestedUserId: string) => {
      calls.push(`get:${requestedUserId}`);
      return options.cosmetics ?? {};
    },
  } as unknown as WordleRewardsService;
  const showcase = {
    get: async (requestedUserId: string) => {
      calls.push(`showcase:${requestedUserId}`);
      return options.showcase ?? [];
    },
  } as unknown as WordleShowcaseService;

  return new WordlePlayerOverviewService(
    wordle,
    rewards,
    showcase,
    () => options.today ?? '2026-11-07',
  );
}

describe('WordlePlayerOverviewService', () => {
  it('hides match evidence from today and keeps older evidence', async () => {
    const service = makeService({
      overview: {
        achievements: [
          { id: 'today', matchEvidence: evidence('2026-11-07') },
          { id: 'older', matchEvidence: evidence('2026-11-06') },
        ],
      },
    });

    const overview = await service.getPublicPlayerOverview(userId, guildId);

    expect(overview.achievements[0]?.matchEvidence).toBeNull();
    expect(overview.achievements[1]?.matchEvidence).toEqual(
      evidence('2026-11-06'),
    );
  });

  it('reconciles rewards before reading cosmetics', async () => {
    const calls: string[] = [];
    const service = makeService({
      calls,
      overview: { achievements: [] },
      cosmetics: { title: 'title', frame: 'frame', badges: [] },
      showcase: [],
    });

    await service.getPublicPlayerOverview(userId, guildId);

    expect(calls).toEqual([
      'overview:user-1:guild-1:',
      'reconcile:user-1',
      'get:user-1',
      'showcase:user-1',
    ]);
  });

  it('exposes only title, frame and badges from cosmetics', async () => {
    const service = makeService({
      overview: { achievements: [] },
      cosmetics: {
        title: 'title',
        frame: 'frame',
        badges: [
          {
            goalId: 'goal-1',
            guildId,
            grantedAt: 1,
            startsAt: 2,
            endsAt: 3,
          },
        ],
        extra: 'x',
      },
    });

    const overview = await service.getPublicPlayerOverview(userId, guildId);

    expect(overview.cosmetics).toEqual({
      title: 'title',
      frame: 'frame',
      badges: [
        {
          goalId: 'goal-1',
          guildId,
          grantedAt: 1,
          startsAt: 2,
          endsAt: 3,
        },
      ],
    });
  });
});
