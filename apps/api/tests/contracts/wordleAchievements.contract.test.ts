import { callContract } from '@marquinhos/api-client/bot';
import { getAchievements } from '@marquinhos/contracts/http/routes/wordle';
import { db } from '@marquinhos/database/client';
import {
  userAchievements,
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { WordleModule } from '../../src/modules/wordle/wordle.module';
import { startNestContractServer } from '../helpers/contractServer';
import { installWordleAchievementCatalog } from '../helpers/wordleAchievementCatalog';

let server: Awaited<ReturnType<typeof startNestContractServer>>;
let omitAuth = false;
let restoreCatalog: (() => Promise<void>) | undefined;
const guildId = randomUUID();
const userId = randomUUID();

beforeAll(async () => {
  restoreCatalog = await installWordleAchievementCatalog();
  server = await startNestContractServer({ imports: [WordleModule] });
  server.http.interceptors.request.use((config) => {
    if (!omitAuth) return config;
    const headers = new Headers(config.headers);
    headers.delete('authorization');
    return { ...config, headers };
  });
  await db.insert(wordleGlobalDays).values({
    word_date: '2026-01-01',
    word: 'termo',
    word_length: 5,
    created_at: 0,
  });
  await db.insert(wordleGlobalSessions).values({
    id: randomUUID(),
    user_id: userId,
    word_date: '2026-01-01',
    guesses: '[]',
    solved: true,
    attempts: 2,
    created_at: 0,
  });
});

afterAll(async () => {
  await server.close();
  await restoreCatalog?.();
});

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
      response.data.achievements.find((a) => a.id === 'wordle_v2_wins_10')
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

  it('returns the same global player history from another community', async () => {
    const response = await callContract(server.http, getAchievements, {
      params: { guildId: 'elsewhere', userId },
    });
    expect(response.data.stats).toMatchObject({
      played: 1,
      wins: 1,
      winRate: 100,
    });
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
