import type {
  WordleDraft,
  WordleDraftWrite,
  WordleDraftWriteResult,
} from '@marquinhos/contracts/wordle';
import { db } from '@marquinhos/database/client';
import {
  wordleDays,
  wordleDrafts,
  wordleSessions,
} from '@marquinhos/database/schema';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { WordleAchievementService } from 'services/wordle/WordleAchievementService';
import {
  getWordleDayEndEpoch,
  getWordleTimeZone,
} from 'services/wordle/wordleDate';
import { lockWordleDay, lockWordlePlayer } from './gameplayLock';
import { updateWordleStreak } from './streaks';

type DraftRow = typeof wordleDrafts.$inferSelect;

function dateAt(epochMs: number): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: getWordleTimeZone(),
  }).format(new Date(epochMs));
}

function toDraft(row: DraftRow): WordleDraft {
  return {
    date: row.word_date,
    rowIndex: row.row_index,
    cells: row.cells,
    activeIndex: row.active_index,
    revision: row.revision,
  };
}

function isCompleteWinningDraft(
  cells: readonly string[],
  answer: string,
): boolean {
  const draft = cells.join('');
  return (
    cells.every((cell) => cell.length === 1) &&
    stripDiacritics(draft.toLocaleLowerCase('pt-BR')) ===
      stripDiacritics(answer.toLocaleLowerCase('pt-BR'))
  );
}

export class WordleDraftService {
  constructor(private readonly now: () => number = Date.now) {}

  async getCurrentDraft(
    userId: string,
    guildId: string,
    date = dateAt(this.now()),
    attempts = 0,
    solved = false,
  ): Promise<WordleDraft | null> {
    if (solved) return null;
    const [row] = await db
      .select()
      .from(wordleDrafts)
      .where(
        and(
          eq(wordleDrafts.user_id, userId),
          eq(wordleDrafts.guild_id, guildId),
          eq(wordleDrafts.word_date, date),
          eq(wordleDrafts.row_index, attempts),
          isNull(wordleDrafts.finalized_at),
        ),
      );
    return row ? toDraft(row) : null;
  }

  async write(
    userId: string,
    guildId: string,
    input: WordleDraftWrite,
  ): Promise<WordleDraftWriteResult> {
    const now = this.now();
    if (input.date !== dateAt(now)) return { status: 'closed' };

    return db.transaction(async (tx) => {
      await lockWordlePlayer(tx, userId, guildId);
      if (input.date !== dateAt(this.now())) return { status: 'closed' };
      await lockWordleDay(tx, guildId, input.date);
      if (input.date !== dateAt(this.now())) return { status: 'closed' };

      const [daily] = await tx
        .select({ word_length: wordleDays.word_length })
        .from(wordleDays)
        .where(
          and(
            eq(wordleDays.guild_id, guildId),
            eq(wordleDays.word_date, input.date),
          ),
        )
        .for('update');
      if (input.date !== dateAt(this.now())) return { status: 'closed' };
      if (
        !daily?.word_length ||
        input.cells.length !== daily.word_length ||
        input.activeIndex >= daily.word_length
      )
        return { status: 'closed' };

      const [session] = await tx
        .select({
          attempts: wordleSessions.attempts,
          solved: wordleSessions.solved,
        })
        .from(wordleSessions)
        .where(
          and(
            eq(wordleSessions.user_id, userId),
            eq(wordleSessions.guild_id, guildId),
            eq(wordleSessions.word_date, input.date),
          ),
        )
        .for('update');
      if (input.date !== dateAt(this.now())) return { status: 'closed' };
      const currentRow = session?.attempts ?? 0;
      if (session?.solved || currentRow !== input.rowIndex)
        return { status: 'closed' };

      const [saved] = await tx
        .select()
        .from(wordleDrafts)
        .where(
          and(
            eq(wordleDrafts.user_id, userId),
            eq(wordleDrafts.guild_id, guildId),
            eq(wordleDrafts.word_date, input.date),
          ),
        )
        .for('update');
      if (input.date !== dateAt(this.now())) return { status: 'closed' };
      if (saved?.finalized_at !== null && saved !== undefined)
        return { status: 'closed' };
      if ((saved?.revision ?? 0) !== input.expectedRevision)
        return { status: 'conflict', draft: saved ? toDraft(saved) : null };

      const updatedAt = Math.floor(this.now() / 1000);
      const revision = (saved?.revision ?? 0) + 1;
      const values = {
        row_index: input.rowIndex,
        cells: input.cells,
        active_index: input.activeIndex,
        revision,
        updated_at: updatedAt,
        finalized_at: null,
        award_reconciled_at: null,
      };
      if (saved) {
        await tx
          .update(wordleDrafts)
          .set(values)
          .where(
            and(
              eq(wordleDrafts.user_id, userId),
              eq(wordleDrafts.guild_id, guildId),
              eq(wordleDrafts.word_date, input.date),
            ),
          );
      } else {
        await tx.insert(wordleDrafts).values({
          user_id: userId,
          guild_id: guildId,
          word_date: input.date,
          ...values,
        });
      }
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
  }

  async finalizeExpiredDrafts(): Promise<void> {
    const today = dateAt(this.now());
    const rows = await db
      .select({
        user_id: wordleDrafts.user_id,
        guild_id: wordleDrafts.guild_id,
        word_date: wordleDrafts.word_date,
      })
      .from(wordleDrafts)
      .where(
        and(
          lt(wordleDrafts.word_date, today),
          or(
            isNull(wordleDrafts.finalized_at),
            isNull(wordleDrafts.award_reconciled_at),
          ),
        ),
      )
      .orderBy(
        asc(wordleDrafts.word_date),
        asc(wordleDrafts.guild_id),
        asc(wordleDrafts.user_id),
      );
    for (const row of rows)
      await this.finalizeOne(row.user_id, row.guild_id, row.word_date);
  }

  async finalizePlayerBefore(
    userId: string,
    guildId: string,
    beforeDate: string,
  ): Promise<void> {
    const rows = await db
      .select({ word_date: wordleDrafts.word_date })
      .from(wordleDrafts)
      .where(
        and(
          eq(wordleDrafts.user_id, userId),
          eq(wordleDrafts.guild_id, guildId),
          lt(wordleDrafts.word_date, beforeDate),
          or(
            isNull(wordleDrafts.finalized_at),
            isNull(wordleDrafts.award_reconciled_at),
          ),
        ),
      )
      .orderBy(asc(wordleDrafts.word_date));
    for (const row of rows)
      await this.finalizeOne(userId, guildId, row.word_date);
  }

  private async finalizeOne(
    userId: string,
    guildId: string,
    date: string,
  ): Promise<void> {
    const finalizedAt = Math.floor(this.now() / 1000);
    const outcome = await db.transaction(async (tx) => {
      await lockWordlePlayer(tx, userId, guildId);
      await lockWordleDay(tx, guildId, date);
      const [draft] = await tx
        .select()
        .from(wordleDrafts)
        .where(
          and(
            eq(wordleDrafts.user_id, userId),
            eq(wordleDrafts.guild_id, guildId),
            eq(wordleDrafts.word_date, date),
          ),
        )
        .for('update');
      if (!draft || date >= dateAt(this.now())) return { reconcile: false };

      const [session] = await tx
        .select({
          id: wordleSessions.id,
          attempts: wordleSessions.attempts,
          solved: wordleSessions.solved,
          solved_from_draft: wordleSessions.solved_from_draft,
        })
        .from(wordleSessions)
        .where(
          and(
            eq(wordleSessions.user_id, userId),
            eq(wordleSessions.guild_id, guildId),
            eq(wordleSessions.word_date, date),
          ),
        )
        .for('update');

      let zeroGuessWin = session?.solved_from_draft === true;
      if (draft.finalized_at === null) {
        const [daily] = await tx
          .select({
            word: wordleDays.word,
            word_length: wordleDays.word_length,
          })
          .from(wordleDays)
          .where(
            and(
              eq(wordleDays.guild_id, guildId),
              eq(wordleDays.word_date, date),
            ),
          )
          .for('update');
        const hasAcceptedGuess = (session?.attempts ?? 0) > 0;
        const isWin =
          !hasAcceptedGuess &&
          !session?.solved &&
          daily?.word !== null &&
          daily?.word !== undefined &&
          draft.cells.length === daily.word_length &&
          isCompleteWinningDraft(draft.cells, daily.word);

        if (isWin) {
          const [sessions] = await tx
            .select({ first_solver: wordleSessions.first_solver })
            .from(wordleSessions)
            .where(
              and(
                eq(wordleSessions.guild_id, guildId),
                eq(wordleSessions.word_date, date),
                eq(wordleSessions.first_solver, true),
              ),
            )
            .limit(1);
          const allDrafts = await tx
            .select({
              user_id: wordleDrafts.user_id,
              cells: wordleDrafts.cells,
              updated_at: wordleDrafts.updated_at,
            })
            .from(wordleDrafts)
            .where(
              and(
                eq(wordleDrafts.guild_id, guildId),
                eq(wordleDrafts.word_date, date),
              ),
            )
            .orderBy(asc(wordleDrafts.updated_at), asc(wordleDrafts.user_id));
          const allSessions = await tx
            .select({
              user_id: wordleSessions.user_id,
              attempts: wordleSessions.attempts,
              solved: wordleSessions.solved,
              solved_from_draft: wordleSessions.solved_from_draft,
            })
            .from(wordleSessions)
            .where(
              and(
                eq(wordleSessions.guild_id, guildId),
                eq(wordleSessions.word_date, date),
              ),
            );
          const existingSessions = new Map(
            allSessions.map((row) => [row.user_id, row]),
          );
          const firstDraftWinner = allDrafts.find(
            (candidate) =>
              (existingSessions.get(candidate.user_id)?.attempts ?? 0) === 0 &&
              (!existingSessions.get(candidate.user_id)?.solved ||
                existingSessions.get(candidate.user_id)?.solved_from_draft ===
                  true) &&
              daily?.word !== null &&
              daily?.word !== undefined &&
              candidate.cells.length === daily.word_length &&
              isCompleteWinningDraft(candidate.cells, daily.word),
          );
          const isFirstSolver =
            sessions === undefined && firstDraftWinner?.user_id === userId;
          const inserted = await tx
            .insert(wordleSessions)
            .values({
              id: randomUUID(),
              user_id: userId,
              guild_id: guildId,
              word_date: date,
              guesses: '[]',
              solved: true,
              solved_from_draft: true,
              solved_at: getWordleDayEndEpoch(date),
              first_solver: isFirstSolver,
              attempts: 0,
              created_at: draft.updated_at,
              word_length: daily!.word_length!,
            })
            .onConflictDoNothing()
            .returning({ id: wordleSessions.id });
          zeroGuessWin = inserted.length > 0 || zeroGuessWin;
          if (inserted.length > 0) {
            await tx
              .update(wordleDays)
              .set({
                players_count: sql`${wordleDays.players_count} + 1`,
                winners_count: sql`${wordleDays.winners_count} + 1`,
              })
              .where(
                and(
                  eq(wordleDays.guild_id, guildId),
                  eq(wordleDays.word_date, date),
                ),
              );
            await updateWordleStreak(userId, guildId, tx);
          }
        }

        await tx
          .update(wordleDrafts)
          .set({
            finalized_at: finalizedAt,
            award_reconciled_at: zeroGuessWin ? null : finalizedAt,
          })
          .where(
            and(
              eq(wordleDrafts.user_id, userId),
              eq(wordleDrafts.guild_id, guildId),
              eq(wordleDrafts.word_date, date),
              isNull(wordleDrafts.finalized_at),
            ),
          );
      }
      return { reconcile: zeroGuessWin && draft.award_reconciled_at === null };
    });

    if (!outcome.reconcile) return;
    try {
      await db.transaction((tx) =>
        new WordleAchievementService().checkAndAward(userId, guildId, tx),
      );
      await db
        .update(wordleDrafts)
        .set({ award_reconciled_at: Math.floor(this.now() / 1000) })
        .where(
          and(
            eq(wordleDrafts.user_id, userId),
            eq(wordleDrafts.guild_id, guildId),
            eq(wordleDrafts.word_date, date),
            isNull(wordleDrafts.award_reconciled_at),
          ),
        );
    } catch (error) {
      console.warn('[wordle] wordle.draft_award_failed', error);
    }
  }
}
