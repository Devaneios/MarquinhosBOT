import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleCommunityFirstSolves,
  wordleCommunityWinAnnouncements,
  wordleGlobalDays,
  wordleGlobalDrafts,
  wordleGlobalOccurrences,
  wordleGlobalSessions,
  wordleUsedWords,
  wordlistReview,
} from '@marquinhos/database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { eq, sql } from 'drizzle-orm';
import {
  WORDLE_ANSWER_WORDS,
  WORDLE_DEVANEIOS_WORDS,
  WORDLE_NOW,
  WORDLE_RANDOM,
  type WordSource,
} from 'modules/wordle/wordle.tokens';

@Injectable()
export class WordleGlobalDayService {
  constructor(
    @Inject(DB) private readonly database: Db,
    @Inject(WORDLE_ANSWER_WORDS)
    private readonly words: WordSource,
    @Inject(WORDLE_DEVANEIOS_WORDS)
    private readonly devaneiosWords: WordSource,
    @Inject(WORDLE_RANDOM)
    private readonly random: () => number = Math.random,
    @Inject(WORDLE_NOW)
    private readonly now: () => number = Date.now,
  ) {}

  async getOrCreate(
    date: string,
    mode: 'keep' | 'replace' = 'keep',
  ): Promise<{ word: string; wordDate: string; wordLength: number }> {
    if (mode === 'keep') {
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
    }
    return this.database.transaction(async (tx) => {
      // Serialize selection across dates as the used-word pool is global too.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended('wordle-global-word-selection', 0))`,
      );
      const [existing] = await tx
        .select()
        .from(wordleGlobalDays)
        .where(eq(wordleGlobalDays.word_date, date));
      if (existing && mode === 'keep')
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
            word !== existing?.word &&
            !used.has(word) &&
            !banned.has(word),
        );
      const preferDevaneios = this.random() < 0.75;
      let candidates = available(
        preferDevaneios ? this.devaneiosWords() : this.words(),
      );
      if (candidates.length === 0)
        candidates = available(
          preferDevaneios ? this.words() : this.devaneiosWords(),
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
      const day = {
        word_date: date,
        word,
        word_length: word.length,
        created_at: createdAt,
      };
      if (existing) {
        // Gameplay and draft writes hold a shared lock on the day.
        await tx
          .update(wordleGlobalDays)
          .set(day)
          .where(eq(wordleGlobalDays.word_date, date));
        await tx
          .delete(wordleGlobalDrafts)
          .where(eq(wordleGlobalDrafts.word_date, date));
        await tx
          .delete(wordleGlobalSessions)
          .where(eq(wordleGlobalSessions.word_date, date));
        await tx
          .delete(wordleGlobalOccurrences)
          .where(eq(wordleGlobalOccurrences.word_date, date));
        await tx
          .delete(wordleCommunityDailyPresence)
          .where(eq(wordleCommunityDailyPresence.word_date, date));
        await tx
          .delete(wordleCommunityFirstSolves)
          .where(eq(wordleCommunityFirstSolves.word_date, date));
        await tx
          .delete(wordleCommunityWinAnnouncements)
          .where(eq(wordleCommunityWinAnnouncements.word_date, date));
      } else {
        await tx.insert(wordleGlobalDays).values(day);
      }
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
