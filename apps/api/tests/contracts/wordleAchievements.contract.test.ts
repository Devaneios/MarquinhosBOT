import { callContract } from '@marquinhos/api-client/bot';
import { getAchievements } from '@marquinhos/contracts/http/routes/wordle';
import { db } from '@marquinhos/database/client';
import {
  userAchievements,
  wordleDays,
  wordleSessions,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import wordleRouter from '../../src/routes/wordle.route';
import { startContractServer } from '../helpers/contractServer';

let server: Awaited<ReturnType<typeof startContractServer>>;
let omitAuth = false;
const guildId = randomUUID();
const userId = randomUUID();

beforeAll(async () => {
  server = await startContractServer((app) =>
    app.use('/api/wordle', wordleRouter),
  );
  server.http.interceptors.request.use((config) => {
    if (!omitAuth) return config;
    const headers = new Headers(config.headers);
    headers.delete('authorization');
    return { ...config, headers };
  });
  await db.insert(wordleDays).values({
    guild_id: guildId,
    word_date: '2026-01-01',
    word: null,
    word_length: 5,
    is_legacy: true,
    created_at: 0,
  });
  await db.insert(wordleSessions).values({
    id: randomUUID(),
    user_id: userId,
    guild_id: guildId,
    word_date: '2026-01-01',
    solved: true,
    attempts: 2,
    created_at: 0,
  });
});

afterAll(() => server.close());

describe('Wordle achievement overview contract', () => {
  it('serves scoped stats and progress without awarding on GET', async () => {
    const response = await callContract(server.http, getAchievements, {
      params: { guildId, userId },
    });
    expect(response.data.stats).toMatchObject({
      played: 1,
      wins: 1,
      winRate: 100,
    });
    expect(response.data.achievements).toHaveLength(
      WORDLE_ACHIEVEMENT_CATALOG.length,
    );
    expect(
      response.data.achievements.find((a) => a.id === 'wordle_wins_10')
        ?.progress,
    ).toEqual({ current: 1, target: 10 });
    expect(
      response.data.achievements
        .filter((a) => a.hidden)
        .every(
          (a) =>
            a.name === '' &&
            a.description === '' &&
            a.icon === '❔' &&
            a.progress === null,
        ),
    ).toBe(true);
    expect(
      await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.user_id, userId)),
    ).toEqual([]);
  });

  it('does not expose a player history from another guild', async () => {
    const response = await callContract(server.http, getAchievements, {
      params: { guildId: 'elsewhere', userId },
    });
    expect(response.data.stats).toMatchObject({
      played: 0,
      wins: 0,
      winRate: 0,
    });
    expect(
      response.data.achievements.every((a) => a.holdersPercent === null),
    ).toBe(true);
  });

  it('requires bot authentication', async () => {
    omitAuth = true;
    try {
      await expect(
        callContract(server.http, getAchievements, {
          params: { guildId, userId },
        }),
      ).rejects.toMatchObject({ response: { status: 401 } });
    } finally {
      omitAuth = false;
    }
  });
});
