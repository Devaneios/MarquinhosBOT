import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { runMigrations } from './migrate';
import { users, wordleUserConfig } from './schema';
import { createTestDb, type TestDb } from './testing';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.drop();
});

describe('baseline migrations', () => {
  test('re-running is a no-op', async () => {
    await runMigrations(testDb.db);
    const rows = await testDb.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`,
    );
    expect(rows[0]!.n).toBeGreaterThanOrEqual(2);
  });

  test('stamps updated_at on update', async () => {
    await testDb.db.insert(users).values({ id: 'u1' });
    await testDb.db
      .update(users)
      .set({ lastfm_username: 'x' })
      .where(sql`${users.id} = 'u1'`);
    const [row] = await testDb.db.select().from(users);
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(row!.updated_at).toBeGreaterThan(nowSeconds - 60);
    expect(row!.updated_at).toBeLessThanOrEqual(nowSeconds + 1);
  });

  test('wordle user config starts with every option disabled', async () => {
    await testDb.db.insert(wordleUserConfig).values({ user_id: 'fresh' });
    const [row] = await testDb.db
      .select()
      .from(wordleUserConfig)
      .where(sql`${wordleUserConfig.user_id} = 'fresh'`);
    expect(row).toMatchObject({
      invert_action_keys: false,
      enable_sounds: false,
      enable_space_key: false,
      enable_arrow_keys: false,
    });
  });

  test('wordle arrow keys require the space key', async () => {
    const insert = testDb.db.insert(wordleUserConfig).values({
      user_id: 'u1',
      enable_arrow_keys: true,
      enable_space_key: false,
    });
    await expect(insert.execute()).rejects.toThrow();
  });
});
