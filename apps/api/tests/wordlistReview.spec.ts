import { beforeEach, describe, expect, it } from 'bun:test';

import { db } from '@marquinhos/database/client';
import { wordlistReview } from '@marquinhos/database/schema';
import { eq, sql } from 'drizzle-orm';

async function isBanned(word: string) {
  const [row] = await db
    .select({ is_banned: wordlistReview.is_banned })
    .from(wordlistReview)
    .where(eq(wordlistReview.word, word));
  return row?.is_banned;
}

const { WordleService } = await import('../src/services/wordle');

describe('WordleService wordlist review', () => {
  let service: WordleService;

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE wordlist_review RESTART IDENTITY`);
    service = new WordleService();
  });

  it('starts review at index 0 of wordlist.txt, seeding the table on first call', async () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const words: string[] = readFileSync(
      join(__dirname, '../wordlist.txt'),
      'utf-8',
    )
      .split('\n')
      .map((w: string) => w.trim().toLowerCase())
      .filter((w: string) => w.length > 0);

    const result = await service.getNextReviewWord();
    expect(result).toEqual({
      word: words[0],
      index: 0,
      total: words.length,
      done: false,
    });
  });

  it('advances the cursor and does not ban the word on keep', async () => {
    const first = await service.getNextReviewWord();
    const next = await service.submitReviewDecision(
      first.word as string,
      'keep',
    );

    expect(next.index).toBe(1);
    expect(await isBanned(first.word as string)).toBe(false);
  });

  it('advances the cursor and bans the word on remove', async () => {
    const first = await service.getNextReviewWord();
    await service.submitReviewDecision(first.word as string, 'remove');

    expect(await isBanned(first.word as string)).toBe(true);
  });

  it('resumes from the persisted review state across service instances', async () => {
    const first = await service.getNextReviewWord();
    await service.submitReviewDecision(first.word as string, 'keep');

    const resumed = new WordleService();
    const next = await resumed.getNextReviewWord();
    expect(next.index).toBe(1);
    expect(next.word).not.toBe(first.word);
  });

  it('reports done once every word has been reviewed', async () => {
    await service.getNextReviewWord(); // seed the table
    await db.update(wordlistReview).set({ is_banned: false });

    const result = await service.getNextReviewWord();
    expect(result.done).toBe(true);
    expect(result.word).toBeNull();
  });
});
