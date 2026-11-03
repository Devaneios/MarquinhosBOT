import type { Db } from '@marquinhos/database/client';
import {
  wordleGlobalDays,
  wordleUsedWords,
  wordlistReview,
} from '@marquinhos/database/schema';
import { eq, sql } from 'drizzle-orm';

export class WordleGlobalDayService {
  constructor(
    private readonly database: Db,
    private readonly words: readonly string[],
    private readonly devaneiosWords: readonly string[],
    private readonly random: () => number = Math.random,
    private readonly now: () => number = Date.now,
  ) {}

  async getOrCreate(
    date: string,
  ): Promise<{ word: string; wordDate: string; wordLength: number }> {
    // Days are never changed once created, so an existing one needs no lock.
    const [stored] = await this.database
      .select()
      .from(wordleGlobalDays)
      .where(eq(wordleGlobalDays.word_date, date));
    if (stored)
      return {
        word: stored.word,
        wordDate: date,
        wordLength: stored.word_length,
      };
    return this.database.transaction(async (tx) => {
      // Serialize selection across dates as the used-word pool is global too.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended('wordle-global-word-selection', 0))`,
      );
      const [existing] = await tx
        .select()
        .from(wordleGlobalDays)
        .where(eq(wordleGlobalDays.word_date, date));
      if (existing)
        return {
          word: existing.word,
          wordDate: date,
          wordLength: existing.word_length,
        };

      const used = new Set(
        (
          await tx.select({ word: wordleUsedWords.word }).from(wordleUsedWords)
        ).map((row) => row.word),
      );
      const banned = new Set(
        (
          await tx
            .select({ word: wordlistReview.word })
            .from(wordlistReview)
            .where(eq(wordlistReview.is_banned, true))
        ).map((row) => row.word),
      );
      const available = (list: readonly string[]) =>
        list.filter(
          (word) =>
            word.length >= 5 &&
            word.length <= 6 &&
            !used.has(word) &&
            !banned.has(word),
        );
      const preferDevaneios = this.random() < 0.75;
      let candidates = available(
        preferDevaneios ? this.devaneiosWords : this.words,
      );
      if (candidates.length === 0)
        candidates = available(
          preferDevaneios ? this.words : this.devaneiosWords,
        );
      if (candidates.length === 0)
        throw new Error('No available words left in the wordlist');
      const lengths = [...new Set(candidates.map((word) => word.length))];
      const length = lengths[Math.floor(this.random() * lengths.length)];
      const pool = candidates.filter((word) => word.length === length);
      const word = pool[Math.floor(this.random() * pool.length)];
      if (word === undefined)
        throw new Error('No available words left in the wordlist');
      const createdAt = Math.floor(this.now() / 1000);
      await tx.insert(wordleGlobalDays).values({
        word_date: date,
        word,
        word_length: word.length,
        created_at: createdAt,
      });
      await tx
        .insert(wordleUsedWords)
        .values({ word, used_at: createdAt })
        .onConflictDoUpdate({
          target: wordleUsedWords.word,
          set: { used_at: createdAt },
        });
      return { word, wordDate: date, wordLength: word.length };
    });
  }
}
