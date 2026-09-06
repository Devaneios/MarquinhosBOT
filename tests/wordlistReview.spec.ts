import { beforeEach, describe, expect, it } from 'bun:test';

process.env.SQLITE_PATH = ':memory:';

const { db } = await import('../src/database/sqlite');
const { WordleService } = await import('../src/services/wordle');

describe('WordleService wordlist review', () => {
  let service: WordleService;

  beforeEach(() => {
    db.run('DELETE FROM wordlist_review');
    service = new WordleService();
  });

  it('starts review at index 0 of wordlist.txt, seeding the table on first call', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const words: string[] = readFileSync(
      join(__dirname, '../wordlist.txt'),
      'utf-8',
    )
      .split('\n')
      .map((w: string) => w.trim().toLowerCase())
      .filter((w: string) => w.length > 0);

    const result = service.getNextReviewWord();
    expect(result).toEqual({
      word: words[0],
      index: 0,
      total: words.length,
      done: false,
    });
  });

  it('advances the cursor and does not ban the word on keep', () => {
    const first = service.getNextReviewWord();
    const next = service.submitReviewDecision(first.word as string, 'keep');

    expect(next.index).toBe(1);
    const row = db
      .query<
        { is_banned: number | null },
        { $word: string }
      >('SELECT is_banned FROM wordlist_review WHERE word = $word')
      .get({ $word: first.word as string });
    expect(row?.is_banned).toBe(0);
  });

  it('advances the cursor and bans the word on remove', () => {
    const first = service.getNextReviewWord();
    service.submitReviewDecision(first.word as string, 'remove');

    const row = db
      .query<
        { is_banned: number | null },
        { $word: string }
      >('SELECT is_banned FROM wordlist_review WHERE word = $word')
      .get({ $word: first.word as string });
    expect(row?.is_banned).toBe(1);
  });

  it('resumes from the persisted review state across service instances', () => {
    const first = service.getNextReviewWord();
    service.submitReviewDecision(first.word as string, 'keep');

    const resumed = new WordleService();
    const next = resumed.getNextReviewWord();
    expect(next.index).toBe(1);
    expect(next.word).not.toBe(first.word);
  });

  it('reports done once every word has been reviewed', () => {
    service.getNextReviewWord(); // seed the table
    db.run('UPDATE wordlist_review SET is_banned = 0');

    const result = service.getNextReviewWord();
    expect(result.done).toBe(true);
    expect(result.word).toBeNull();
  });
});
