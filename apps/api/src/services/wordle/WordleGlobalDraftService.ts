import type {
  WordleDraft,
  WordleDraftWrite,
  WordleDraftWriteResult,
} from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleGlobalDays,
  wordleGlobalDrafts,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { lockGlobalWordlePlayer } from './gameplayLock';
import { getWordleTimeZone } from './wordleDate';

class GlobalDraftCutoff extends Error {}

type DraftRow = typeof wordleGlobalDrafts.$inferSelect;

function dayAt(time: number): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: getWordleTimeZone(),
  }).format(new Date(time));
}
function asDraft(row: DraftRow): WordleDraft {
  return {
    date: row.word_date,
    rowIndex: row.row_index,
    cells: row.cells,
    activeIndex: row.active_index,
    revision: row.revision,
  };
}

export class WordleGlobalDraftService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async getCurrentDraft(
    userId: string,
    date: string,
    attempts: number,
    solved: boolean,
  ): Promise<WordleDraft | null> {
    if (solved) return null;
    const [row] = await this.database
      .select()
      .from(wordleGlobalDrafts)
      .where(
        and(
          eq(wordleGlobalDrafts.user_id, userId),
          eq(wordleGlobalDrafts.word_date, date),
          eq(wordleGlobalDrafts.row_index, attempts),
          isNull(wordleGlobalDrafts.finalized_at),
        ),
      );
    return row ? asDraft(row) : null;
  }

  async write(
    userId: string,
    input: WordleDraftWrite,
  ): Promise<WordleDraftWriteResult> {
    if (input.date !== dayAt(this.now())) return { status: 'closed' };
    try {
      return await this.database.transaction(async (tx) => {
        await lockGlobalWordlePlayer(tx, userId, input.date);
        if (input.date !== dayAt(this.now())) return { status: 'closed' };
        const [day] = await tx
          .select()
          .from(wordleGlobalDays)
          .where(eq(wordleGlobalDays.word_date, input.date))
          .for('update');
        if (
          input.date !== dayAt(this.now()) ||
          !day ||
          input.cells.length !== day.word_length ||
          input.activeIndex >= day.word_length
        )
          return { status: 'closed' };
        const [session] = await tx
          .select()
          .from(wordleGlobalSessions)
          .where(
            and(
              eq(wordleGlobalSessions.user_id, userId),
              eq(wordleGlobalSessions.word_date, input.date),
            ),
          )
          .for('update');
        if (session?.solved || (session?.attempts ?? 0) !== input.rowIndex)
          return { status: 'closed' };
        const [saved] = await tx
          .select()
          .from(wordleGlobalDrafts)
          .where(
            and(
              eq(wordleGlobalDrafts.user_id, userId),
              eq(wordleGlobalDrafts.word_date, input.date),
            ),
          )
          .for('update');
        if (
          input.date !== dayAt(this.now()) ||
          (saved && saved.finalized_at !== null)
        )
          return { status: 'closed' };
        if ((saved?.revision ?? 0) !== input.expectedRevision)
          return { status: 'conflict', draft: saved ? asDraft(saved) : null };
        const revision = (saved?.revision ?? 0) + 1;
        const values = {
          row_index: input.rowIndex,
          cells: input.cells,
          active_index: input.activeIndex,
          revision,
          updated_at: Math.floor(this.now() / 1000),
          finalized_at: null,
          award_reconciled_at: null,
        };
        if (saved)
          await tx
            .update(wordleGlobalDrafts)
            .set(values)
            .where(
              and(
                eq(wordleGlobalDrafts.user_id, userId),
                eq(wordleGlobalDrafts.word_date, input.date),
              ),
            );
        else
          await tx
            .insert(wordleGlobalDrafts)
            .values({ user_id: userId, word_date: input.date, ...values });
        if (input.date !== dayAt(this.now())) throw new GlobalDraftCutoff();
        return {
          status: 'saved',
          draft: {
            date: input.date,
            rowIndex: input.rowIndex,
            cells: input.cells,
            activeIndex: input.activeIndex,
            revision,
          },
        };
      });
    } catch (error) {
      if (error instanceof GlobalDraftCutoff) return { status: 'closed' };
      throw error;
    }
  }
}
