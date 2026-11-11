import type { wordleReviewWordResultSchema } from '@marquinhos/contracts/http/routes/wordle';
import type { Db } from '@marquinhos/database/client';
import { wordleUsedWords, wordlistReview } from '@marquinhos/database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { asc, count, eq, isNull } from 'drizzle-orm';
import { WordBankService } from 'modules/wordle/words/word-bank.service';
import type { z } from 'zod';

export type ReviewWordResult = z.input<typeof wordleReviewWordResultSchema>;

// Keeps each multi-row insert well under Postgres' 65535 bind-parameter cap.
const REVIEW_SEED_BATCH_SIZE = 5_000;

@Injectable()
export class WordleWordlistReviewService {
  constructor(
    @Inject(DB) private readonly database: Db,
    private readonly wordBank: WordBankService,
  ) {}

  private async ensureReviewSeeded(): Promise<void> {
    const [row] = await this.database
      .select({ count: count() })
      .from(wordlistReview);
    if (row && row.count > 0) return;

    const words = this.wordBank.getAnswerWordlist();
    await this.database.transaction(async (tx) => {
      for (let i = 0; i < words.length; i += REVIEW_SEED_BATCH_SIZE) {
        // Inserted one batch at a time, in file order, so seq follows the
        // wordlist and the review walks it top to bottom.
        await tx
          .insert(wordlistReview)
          .values(
            words
              .slice(i, i + REVIEW_SEED_BATCH_SIZE)
              .map((word) => ({ word, is_banned: null })),
          )
          .onConflictDoNothing();
      }
    });
  }

  async getNextReviewWord(): Promise<ReviewWordResult> {
    await this.ensureReviewSeeded();

    const [counts] = await this.database
      .select({
        total: count(),
        reviewed: count(wordlistReview.is_banned),
      })
      .from(wordlistReview);
    const total = counts?.total ?? 0;
    const reviewed = counts?.reviewed ?? 0;
    const [next] = await this.database
      .select({ word: wordlistReview.word })
      .from(wordlistReview)
      .where(isNull(wordlistReview.is_banned))
      .orderBy(asc(wordlistReview.seq))
      .limit(1);

    if (!next) {
      return { word: null, index: total, total, done: true };
    }

    return { word: next.word, index: reviewed, total, done: false };
  }

  async submitReviewDecision(
    word: string,
    decision: 'keep' | 'remove',
  ): Promise<ReviewWordResult> {
    await this.ensureReviewSeeded();

    await this.database
      .update(wordlistReview)
      .set({ is_banned: decision === 'remove' })
      .where(eq(wordlistReview.word, word));
    this.wordBank.setBanned(word, decision === 'remove');

    return this.getNextReviewWord();
  }

  async getWordlistPoolStats(): Promise<{
    total: number;
    used: number;
    remaining: number;
  }> {
    const wordlist = this.wordBank.getAnswerWordlist();
    const total = wordlist.filter((w) => w.length >= 5 && w.length <= 6).length;
    const [row] = await this.database
      .select({ count: count() })
      .from(wordleUsedWords);
    const used = row?.count ?? 0;
    return { total, used, remaining: total - used };
  }
}
