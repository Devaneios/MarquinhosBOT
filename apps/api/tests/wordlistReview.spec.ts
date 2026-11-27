import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';

import type { Db } from '@marquinhos/database/client';
import { wordlistReview } from '@marquinhos/database/schema';
import { eq } from 'drizzle-orm';

import { createTestDb, type TestDb } from '@marquinhos/database/testing';
async function isBanned(database: Db, word: string) {
  const [row] = await database
    .select({ is_banned: wordlistReview.is_banned })
    .from(wordlistReview)
    .where(eq(wordlistReview.word, word));
  return row?.is_banned;
}

import type { WordleWordlistReviewService } from '../src/modules/wordle/words/wordle-wordlist-review.service';
import { createWordleTestServices } from './helpers/wordleServices';

describe('WordleWordlistReviewService', () => {
  let fixture: TestDb;
  let service: WordleWordlistReviewService;

  beforeAll(async () => {
    fixture = await createTestDb();
  }, 30_000);

  afterAll(async () => {
    await fixture.drop();
  }, 30_000);

  beforeEach(async () => {
    // Keep the large wordlist seeded between cases; each test only needs the
    // review decisions reset, not another 40,000-row insert.
    await fixture.db.update(wordlistReview).set({ is_banned: null });
    service = createWordleTestServices(fixture.db).wordlistReview;
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
  }, 30_000);

  it('advances the cursor and does not ban the word on keep', async () => {
    const first = await service.getNextReviewWord();
    if (!first.word) throw new Error('Expected a word to review');
    const next = await service.submitReviewDecision(first.word, 'keep');

    expect(next.index).toBe(1);
    expect(await isBanned(fixture.db, first.word)).toBe(false);
  });

  it('advances the cursor and bans the word on remove', async () => {
    const first = await service.getNextReviewWord();
    if (!first.word) throw new Error('Expected a word to review');
    await service.submitReviewDecision(first.word, 'remove');

    expect(await isBanned(fixture.db, first.word)).toBe(true);
  });

  it('resumes from the persisted review state across service instances', async () => {
    const first = await service.getNextReviewWord();
    if (!first.word) throw new Error('Expected a word to review');
    await service.submitReviewDecision(first.word, 'keep');

    const resumed = createWordleTestServices(fixture.db).wordlistReview;
    const next = await resumed.getNextReviewWord();
    expect(next.index).toBe(1);
    expect(next.word).not.toBe(first.word);
  });

  it('reports done once every word has been reviewed', async () => {
    await service.getNextReviewWord(); // seed the table
    await fixture.db.update(wordlistReview).set({ is_banned: false });

    const result = await service.getNextReviewWord();
    expect(result.done).toBe(true);
    expect(result.word).toBeNull();
  });
});
