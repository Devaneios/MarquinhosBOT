import type {
  WordleDraft,
  WordleDraftWrite,
  WordleDraftWriteResult,
} from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleCommunityFirstSolves,
  wordleGlobalDays,
  wordleGlobalDrafts,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { and, asc, eq, isNull, lt, lte, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { logger } from 'utils/logger';
import { WordleGlobalAchievementService } from './WordleGlobalAchievementService';
import { lockGlobalWordlePlayer } from './gameplayLock';
import { getWordleDayEndEpoch, getWordleTimeZone } from './wordleDate';

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
    private readonly award: (
      userId: string,
      guildId: string,
    ) => Promise<unknown> = (userId, guildId) =>
      new WordleGlobalAchievementService(database, now).checkAndAward(
        userId,
        guildId,
      ),
  ) {}

  async finalizeExpiredDrafts(): Promise<void> {
    const before = dayAt(this.now());
    const rows = await this.database
      .select({
        userId: wordleGlobalDrafts.user_id,
        date: wordleGlobalDrafts.word_date,
      })
      .from(wordleGlobalDrafts)
      .where(
        and(
          lt(wordleGlobalDrafts.word_date, before),
          or(
            isNull(wordleGlobalDrafts.finalized_at),
            isNull(wordleGlobalDrafts.award_reconciled_at),
          ),
        ),
      )
      .orderBy(
        asc(wordleGlobalDrafts.word_date),
        asc(wordleGlobalDrafts.user_id),
      );
    for (const row of rows) await this.finalizeOne(row.userId, row.date);
  }

  async finalizePlayerBefore(
    userId: string,
    beforeDate: string,
  ): Promise<void> {
    const rows = await this.database
      .select({ date: wordleGlobalDrafts.word_date })
      .from(wordleGlobalDrafts)
      .where(
        and(
          eq(wordleGlobalDrafts.user_id, userId),
          lt(wordleGlobalDrafts.word_date, beforeDate),
          or(
            isNull(wordleGlobalDrafts.finalized_at),
            isNull(wordleGlobalDrafts.award_reconciled_at),
          ),
        ),
      )
      .orderBy(asc(wordleGlobalDrafts.word_date));
    for (const row of rows) await this.finalizeOne(userId, row.date);
  }

  private async finalizeOne(userId: string, date: string): Promise<void> {
    const finalizedAt = Math.floor(this.now() / 1000);
    const outcome = await this.database.transaction(async (tx) => {
      await lockGlobalWordlePlayer(tx, userId, date);
      const [day] = await tx
        .select()
        .from(wordleGlobalDays)
        .where(eq(wordleGlobalDays.word_date, date))
        .for('update');
      const [draft] = await tx
        .select()
        .from(wordleGlobalDrafts)
        .where(
          and(
            eq(wordleGlobalDrafts.user_id, userId),
            eq(wordleGlobalDrafts.word_date, date),
          ),
        )
        .for('update');
      if (!draft || !day || date >= dayAt(this.now())) return { guildId: null };
      const [session] = await tx
        .select()
        .from(wordleGlobalSessions)
        .where(
          and(
            eq(wordleGlobalSessions.user_id, userId),
            eq(wordleGlobalSessions.word_date, date),
          ),
        )
        .for('update');
      let draftWin = session?.solved_from_draft === true;
      const normalize = (value: string) =>
        stripDiacritics(value.toLocaleLowerCase('pt-BR'));
      const matches = (cells: readonly string[]) =>
        cells.length === day.word_length &&
        cells.every((cell) => cell.length === 1) &&
        normalize(cells.join('')) === normalize(day.word);
      if (draft.finalized_at === null) {
        if (
          (!session || (!session.solved && session.attempts === 0)) &&
          draft.updated_at <= getWordleDayEndEpoch(date) &&
          matches(draft.cells)
        ) {
          const sessionId = session?.id ?? randomUUID();
          if (session) {
            await tx
              .update(wordleGlobalSessions)
              .set({
                solved: true,
                solved_from_draft: true,
                solved_at: getWordleDayEndEpoch(date),
              })
              .where(eq(wordleGlobalSessions.id, sessionId));
          } else {
            await tx.insert(wordleGlobalSessions).values({
              id: sessionId,
              user_id: userId,
              word_date: date,
              guesses: '[]',
              solved: true,
              solved_from_draft: true,
              solved_at: getWordleDayEndEpoch(date),
              attempts: 0,
              created_at: draft.updated_at,
            });
          }
          draftWin = true;
          const presences = await tx
            .select()
            .from(wordleCommunityDailyPresence)
            .where(eq(wordleCommunityDailyPresence.word_date, date));
          const drafts = await tx
            .select()
            .from(wordleGlobalDrafts)
            .where(eq(wordleGlobalDrafts.word_date, date))
            .orderBy(
              asc(wordleGlobalDrafts.updated_at),
              asc(wordleGlobalDrafts.user_id),
            );
          const sessions = await tx
            .select()
            .from(wordleGlobalSessions)
            .where(eq(wordleGlobalSessions.word_date, date));
          const byUser = new Map(sessions.map((row) => [row.user_id, row]));
          const deadline = getWordleDayEndEpoch(date);
          for (const presence of presences.filter(
            (row) => row.user_id === userId && row.first_seen_at <= deadline,
          )) {
            const eligible = new Set(
              presences
                .filter(
                  (row) =>
                    row.guild_id === presence.guild_id &&
                    row.first_seen_at <= deadline,
                )
                .map((row) => row.user_id),
            );
            const first = drafts.find((row) => {
              const played = byUser.get(row.user_id);
              return (
                eligible.has(row.user_id) &&
                row.updated_at <= deadline &&
                matches(row.cells) &&
                (!played ||
                  played.solved_from_draft ||
                  (!played.solved && played.attempts === 0))
              );
            });
            if (first?.user_id === userId)
              await tx
                .insert(wordleCommunityFirstSolves)
                .values({
                  guild_id: presence.guild_id,
                  word_date: date,
                  user_id: userId,
                  session_id: sessionId,
                  solved_at: deadline,
                })
                .onConflictDoNothing();
          }
        }
        await tx
          .update(wordleGlobalDrafts)
          .set({
            finalized_at: finalizedAt,
            award_reconciled_at: draftWin ? null : finalizedAt,
          })
          .where(
            and(
              eq(wordleGlobalDrafts.user_id, userId),
              eq(wordleGlobalDrafts.word_date, date),
            ),
          );
      }
      if (!draftWin || draft.award_reconciled_at !== null)
        return { guildId: null };
      const [context] = await tx
        .select({ guildId: wordleCommunityDailyPresence.guild_id })
        .from(wordleCommunityDailyPresence)
        .where(
          and(
            eq(wordleCommunityDailyPresence.user_id, userId),
            eq(wordleCommunityDailyPresence.word_date, date),
            lte(
              wordleCommunityDailyPresence.first_seen_at,
              getWordleDayEndEpoch(date),
            ),
          ),
        )
        .orderBy(
          asc(wordleCommunityDailyPresence.first_seen_at),
          asc(wordleCommunityDailyPresence.guild_id),
        )
        .limit(1);
      if (!context) {
        // Without a community there is nowhere to grant XP; achievements
        // still unlock from the full history on the player's next guess.
        await tx
          .update(wordleGlobalDrafts)
          .set({ award_reconciled_at: finalizedAt })
          .where(
            and(
              eq(wordleGlobalDrafts.user_id, userId),
              eq(wordleGlobalDrafts.word_date, date),
            ),
          );
        logger.warn('wordle.draft.award_without_context', { userId, date });
        return { guildId: null };
      }
      return { guildId: context.guildId };
    });
    if (!outcome.guildId) return;
    try {
      await this.award(userId, outcome.guildId);
      await this.database
        .update(wordleGlobalDrafts)
        .set({ award_reconciled_at: Math.floor(this.now() / 1000) })
        .where(
          and(
            eq(wordleGlobalDrafts.user_id, userId),
            eq(wordleGlobalDrafts.word_date, date),
            isNull(wordleGlobalDrafts.award_reconciled_at),
          ),
        );
    } catch (error) {
      console.warn('[wordle] global draft award failed', error);
    }
  }

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
