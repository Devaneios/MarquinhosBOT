import { aiChatConfig } from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import {
  AGENT_DAILY_QUOTA,
  DailyQuotaService,
  RESEARCH_DAILY_QUOTA,
} from 'services/aiChat/DailyQuotaService';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(() => testDb.drop());

beforeEach(() => testDb.reset());

function setConfig(key: string, value: number) {
  return testDb.db.insert(aiChatConfig).values({ key, value });
}

describe('DailyQuotaService.checkAndIncrement', () => {
  let service: DailyQuotaService;

  beforeEach(async () => {
    await setConfig('agent_daily_limit', 2);
    service = new DailyQuotaService(AGENT_DAILY_QUOTA, testDb.db);
  });

  it('allows the first call for a user', async () => {
    expect(
      await service.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(true);
  });

  it('allows calls up to the daily limit', async () => {
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(
      await service.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(true);
  });

  it('blocks calls once the daily limit is exceeded', async () => {
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(
      await service.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(false);
  });

  it('resets the count on a new day', async () => {
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(
      await service.checkAndIncrement('user1', 'guild1', '2026-07-23'),
    ).toBe(true);
  });

  it('does not enforce the limit across different users', async () => {
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(
      await service.checkAndIncrement('user2', 'guild1', '2026-07-22'),
    ).toBe(true);
  });

  it('counts concurrent calls exactly once each', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        service.checkAndIncrement('user1', 'guild1', '2026-07-22'),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(2);
  });
});

describe('DailyQuotaService default limit', () => {
  it('falls back to the default limit when ai_chat_config has no agent_daily_limit row', async () => {
    const fallbackService = new DailyQuotaService(AGENT_DAILY_QUOTA, testDb.db);
    for (let i = 0; i < 50; i++) {
      expect(
        await fallbackService.checkAndIncrement(
          'user1',
          'guild1',
          '2026-07-22',
        ),
      ).toBe(true);
    }
    expect(
      await fallbackService.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(false);
  });
});

describe('DailyQuotaService.seedDefaults', () => {
  it('inserts the agent_daily_limit default when the table is empty', async () => {
    const service = new DailyQuotaService(AGENT_DAILY_QUOTA, testDb.db);
    await service.seedDefaults();
    const [row] = await testDb.db
      .select()
      .from(aiChatConfig)
      .where(eq(aiChatConfig.key, 'agent_daily_limit'));
    expect(row).toEqual({ key: 'agent_daily_limit', value: 50 });
  });

  it('does not overwrite an existing agent_daily_limit row', async () => {
    await setConfig('agent_daily_limit', 20);
    const service = new DailyQuotaService(AGENT_DAILY_QUOTA, testDb.db);
    await service.seedDefaults();
    const [row] = await testDb.db
      .select()
      .from(aiChatConfig)
      .where(eq(aiChatConfig.key, 'agent_daily_limit'));
    expect(row!.value).toBe(20);
  });

  it('backfills agent_daily_limit even when the table already has other config keys', async () => {
    await testDb.db.insert(aiChatConfig).values([
      { key: 'user_daily_limit', value: 10 },
      { key: 'global_daily_limit', value: 200 },
    ]);
    const service = new DailyQuotaService(AGENT_DAILY_QUOTA, testDb.db);
    await service.seedDefaults();
    const rows = await testDb.db
      .select()
      .from(aiChatConfig)
      .orderBy(asc(aiChatConfig.key));
    expect(rows).toEqual([
      { key: 'agent_daily_limit', value: 50 },
      { key: 'global_daily_limit', value: 200 },
      { key: 'user_daily_limit', value: 10 },
    ]);
  });
});

describe('DailyQuotaService with the research quota', () => {
  it('enforces the research_daily_limit stored in ai_chat_config', async () => {
    await setConfig('research_daily_limit', 1);
    const service = new DailyQuotaService(RESEARCH_DAILY_QUOTA, testDb.db);

    expect(
      await service.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(true);
    expect(
      await service.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(false);
  });
});
