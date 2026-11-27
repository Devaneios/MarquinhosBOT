import {
  wordleGlobalDays,
  wordleGlobalDrafts,
} from '@marquinhos/database/schema';
import { createTestDb } from '@marquinhos/database/testing';
import { describe, expect, it, spyOn } from 'bun:test';
import { eq } from 'drizzle-orm';
import {
  createWordleTestGlobalDraftServiceWithAward,
  createWordleTestPresence,
} from './helpers/wordleServices';

describe('Wordle draft finalization recovery', () => {
  it('continues with other players after a draft transaction fails and retries the failed draft', async () => {
    const database = await createTestDb();
    try {
      const date = '2026-11-01';
      const now = Date.parse('2026-11-01T15:00:00Z');
      await database.db.insert(wordleGlobalDays).values({
        word_date: date,
        word: 'termo',
        word_length: 5,
        created_at: 1,
      });
      for (const user of ['a-failed', 'b-healthy']) {
        await createWordleTestPresence(
          database.db,
          user,
          'guild',
          date,
          Math.floor(now / 1000),
        );
      }
      const awarded: string[] = [];
      const writer = createWordleTestGlobalDraftServiceWithAward(
        () => now,
        async (user) => {
          awarded.push(user);
        },
        database.db,
      );
      for (const user of ['a-failed', 'b-healthy']) {
        await writer.write(user, {
          date,
          rowIndex: 0,
          cells: ['t', 'e', 'r', 'm', 'o'],
          activeIndex: 4,
          expectedRevision: 0,
        });
      }
      const finalizer = createWordleTestGlobalDraftServiceWithAward(
        () => now + 86_400_000,
        async (user) => {
          awarded.push(user);
        },
        database.db,
      );
      const transaction = spyOn(
        database.db,
        'transaction',
      ).mockRejectedValueOnce(new Error('temporary transaction failure'));
      await finalizer.finalizeExpiredDrafts();
      transaction.mockRestore();
      expect(awarded).toEqual(['b-healthy']);
      const [pending] = await database.db
        .select()
        .from(wordleGlobalDrafts)
        .where(eq(wordleGlobalDrafts.user_id, 'a-failed'));
      expect(pending?.finalized_at).toBeNull();
      await finalizer.finalizeExpiredDrafts();
      expect(awarded).toEqual(['b-healthy', 'a-failed']);
    } finally {
      await database.drop();
    }
  });
});
