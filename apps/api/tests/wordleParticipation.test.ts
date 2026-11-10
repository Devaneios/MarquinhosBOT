import { wordleCommunityDailyPresence } from '@marquinhos/database/schema';
import { expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { useTestDb } from './helpers/testDb';
import { createWordleTestServices } from './helpers/wordleServices';

const testDb = useTestDb();

it('records participation with the injected clock', async () => {
  const { wordle } = createWordleTestServices(testDb.current.db, {
    now: () => 1_700_000_000_000,
    today: () => '2031-01-02',
  });
  await wordle.recordParticipation('user-clock', 'guild-clock');
  const [row] = await testDb.current.db
    .select()
    .from(wordleCommunityDailyPresence)
    .where(eq(wordleCommunityDailyPresence.user_id, 'user-clock'));
  expect(row?.word_date).toBe('2031-01-02');
  expect(row?.first_seen_at).toBe(1_700_000_000);
});
