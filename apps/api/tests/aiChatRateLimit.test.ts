import { aiChatConfig, aiChatUsage } from '@marquinhos/database/schema';
import { beforeEach, describe, expect, it } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import { RateLimitService } from 'services/aiChat/RateLimitService';
import { useTestDb } from './helpers/testDb';

const testDb = useTestDb();

describe('RateLimitService.checkAndIncrement', () => {
  let service: RateLimitService;

  beforeEach(async () => {
    await testDb.current.db.insert(aiChatConfig).values([
      { key: 'user_daily_limit', value: 2 },
      { key: 'global_daily_limit', value: 3 },
    ]);
    service = new RateLimitService(testDb.current.db);
  });

  it('allows the first call for a user', async () => {
    expect(
      await service.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(true);
  });

  it('allows calls up to the per-user daily limit', async () => {
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(
      await service.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(true);
  });

  it('blocks calls once the per-user daily limit is exceeded', async () => {
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(
      await service.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(false);
  });

  it('resets the per-user count on a new day', async () => {
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(
      await service.checkAndIncrement('user1', 'guild1', '2026-07-23'),
    ).toBe(true);
  });

  it('does not enforce the per-user limit across different users', async () => {
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    expect(
      await service.checkAndIncrement('user2', 'guild1', '2026-07-22'),
    ).toBe(true);
  });

  it('blocks all users once the global daily limit is exceeded', async () => {
    await service.checkAndIncrement('user1', 'guild1', '2026-07-22');
    await service.checkAndIncrement('user2', 'guild1', '2026-07-22');
    await service.checkAndIncrement('user3', 'guild1', '2026-07-22');
    expect(
      await service.checkAndIncrement('user4', 'guild1', '2026-07-22'),
    ).toBe(false);
  });

  it("does not consume a user's budget when the call is blocked by the global limit", async () => {
    // Exhaust the global limit (3) using three different users, each within their own per-user limit (2)
    expect(await service.checkAndIncrement('u1', 'guild1', '2026-07-22')).toBe(
      true,
    );
    expect(await service.checkAndIncrement('u2', 'guild1', '2026-07-22')).toBe(
      true,
    );
    expect(await service.checkAndIncrement('u3', 'guild1', '2026-07-22')).toBe(
      true,
    );

    // u4 is under their own per-user limit but the global cap is now hit → blocked
    expect(await service.checkAndIncrement('u4', 'guild1', '2026-07-22')).toBe(
      false,
    );

    // u4's per-user counter must NOT have been consumed by that blocked call:
    // there should be no ai_chat_usage row for u4 (rolled back)
    const rows = await testDb.current.db
      .select()
      .from(aiChatUsage)
      .where(eq(aiChatUsage.user_id, 'u4'));
    expect(rows).toEqual([]);
  });

  it('lets exactly the global limit through under concurrency', async () => {
    const results = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((user) =>
        service.checkAndIncrement(user, 'guild1', '2026-07-22'),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
  });
});

describe('RateLimitService defaults', () => {
  it('falls back to defaults when ai_chat_config has no rows', async () => {
    const fallbackService = new RateLimitService(testDb.current.db);
    expect(
      await fallbackService.checkAndIncrement('user1', 'guild1', '2026-07-22'),
    ).toBe(true);
  });
});

describe('RateLimitService.seedDefaults', () => {
  const configRows = () =>
    testDb.current.db
      .select()
      .from(aiChatConfig)
      .orderBy(asc(aiChatConfig.key));

  it('inserts default config rows when the table is empty', async () => {
    await new RateLimitService(testDb.current.db).seedDefaults();
    expect(await configRows()).toEqual([
      { key: 'global_daily_limit', value: 2000 },
      { key: 'user_daily_limit', value: 100 },
    ]);
  });

  it('does not overwrite existing config rows', async () => {
    await testDb.current.db
      .insert(aiChatConfig)
      .values({ key: 'user_daily_limit', value: 5 });
    await new RateLimitService(testDb.current.db).seedDefaults();
    const [row] = await testDb.current.db
      .select()
      .from(aiChatConfig)
      .where(eq(aiChatConfig.key, 'user_daily_limit'));
    expect(row!.value).toBe(5);
  });

  it('backfills missing keys even when the table already has other config keys', async () => {
    await testDb.current.db
      .insert(aiChatConfig)
      .values({ key: 'agent_daily_limit', value: 50 });
    await new RateLimitService(testDb.current.db).seedDefaults();
    expect(await configRows()).toEqual([
      { key: 'agent_daily_limit', value: 50 },
      { key: 'global_daily_limit', value: 2000 },
      { key: 'user_daily_limit', value: 100 },
    ]);
  });
});
