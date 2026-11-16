import type { GuessRow } from '@marquinhos/contracts/wordle';
import type { Db, DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  wordleCommunityDailyPresence,
  wordleCommunityFirstSolves,
  wordleGlobalAcceptedGuesses,
  wordleGlobalAchievements,
  wordleGlobalDays,
  wordleGlobalDrafts,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { computeFeedback } from '@marquinhos/domain/games/wordle/feedback';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { and, asc, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { lockGoalFactsForWrite } from 'modules/wordle/community/goal-fact-lock';
import { lockWordleAchievements } from 'modules/wordle/progression/wordle-achievement-lock';
import { getWordleTimeZone } from 'modules/wordle/wordle-date';
import {
  WORDLE_GUESS_RESOLVER,
  WORDLE_NOW,
} from 'modules/wordle/wordle.tokens';
import { randomUUID } from 'node:crypto';
import { lockGlobalWordlePlayer } from './global-gameplay-lock';

class GlobalGameCutoff extends Error {}
export type GlobalGuessResult =
  | {
      guess: string;
      feedback: GuessRow['feedback'];
      guesses: GuessRow[];
      solved: boolean;
      attempts: number;
      wordLength: number;
      achievementBaseline?: string[];
      requestId?: string;
      replayGuildId?: string;
      replayDate?: string;
    }
  | { error: string };
type GlobalGuessReceipt =
  | (Extract<GlobalGuessResult, { guess: string }> & { replayDate: string })
  | { error: string };
const cutoffMessage = 'O dia do jogo mudou. Envie o palpite novamente.';

@Injectable()
export class WordleGlobalGameplayService {
  constructor(
    @Inject(DB) private readonly database: Db,
    @Inject(WORDLE_GUESS_RESOLVER)
    private readonly resolveGuess: (guess: string) => string | null,
    @Inject(WORDLE_NOW)
    private readonly now: () => number = Date.now,
  ) {}

  private today(): string {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: getWordleTimeZone(),
    }).format(new Date(this.now()));
  }

  private async readReceipt(
    exec: DbExecutor,
    userId: string,
    date: string | undefined,
    guess: string,
    requestId: string,
  ): Promise<GlobalGuessReceipt | null> {
    const [receipt] = await exec
      .select({
        event: wordleGlobalAcceptedGuesses,
        session: wordleGlobalSessions,
        day: wordleGlobalDays,
      })
      .from(wordleGlobalAcceptedGuesses)
      .innerJoin(
        wordleGlobalSessions,
        eq(wordleGlobalSessions.id, wordleGlobalAcceptedGuesses.session_id),
      )
      .innerJoin(
        wordleGlobalDays,
        eq(wordleGlobalDays.word_date, wordleGlobalAcceptedGuesses.word_date),
      )
      .where(
        and(
          eq(wordleGlobalAcceptedGuesses.user_id, userId),
          eq(wordleGlobalAcceptedGuesses.request_id, requestId),
        ),
      );
    if (!receipt) return null;
    const guesses = JSON.parse(receipt.session.guesses) as GuessRow[];
    const original = guesses[receipt.event.attempt - 1];
    if (
      (date !== undefined && receipt.event.word_date !== date) ||
      !original ||
      stripDiacritics(original.guess) !==
        stripDiacritics(guess.trim().toLowerCase())
    )
      return { error: 'Identificador de palpite já utilizado.' };
    return {
      guess: original.guess,
      feedback: original.feedback,
      guesses,
      solved: receipt.session.solved,
      attempts: receipt.session.attempts,
      wordLength: receipt.day.word_length,
      requestId,
      replayDate: receipt.event.word_date,
      ...(receipt.event.achievement_baseline !== null
        ? { achievementBaseline: receipt.event.achievement_baseline }
        : {}),
      ...(receipt.event.achievement_guild_id
        ? { replayGuildId: receipt.event.achievement_guild_id }
        : {}),
    };
  }

  async replayGuess(
    userId: string,
    date: string,
    guess: string,
    requestId: string,
  ): Promise<GlobalGuessResult | null> {
    return this.database.transaction(async (tx) => {
      await lockGlobalWordlePlayer(tx, userId, date);
      return this.readReceipt(tx, userId, date, guess, requestId);
    });
  }

  async findReceipt(
    userId: string,
    guess: string,
    requestId: string,
  ): Promise<GlobalGuessReceipt | null> {
    return this.readReceipt(this.database, userId, undefined, guess, requestId);
  }

  async getSession(
    userId: string,
    date: string,
  ): Promise<{
    guesses: GuessRow[];
    solved: boolean;
    attempts: number;
  } | null> {
    const [row] = await this.database
      .select()
      .from(wordleGlobalSessions)
      .where(
        and(
          eq(wordleGlobalSessions.user_id, userId),
          eq(wordleGlobalSessions.word_date, date),
        ),
      );
    return row
      ? {
          guesses: JSON.parse(row.guesses) as GuessRow[],
          solved: row.solved,
          attempts: row.attempts,
        }
      : null;
  }

  async submitGuess(
    userId: string,
    date: string,
    guess: string,
    guildId?: string,
    captureAchievementBaseline = false,
    requestId?: string,
  ): Promise<GlobalGuessResult> {
    if (requestId) {
      const receipt = await this.readReceipt(
        this.database,
        userId,
        date,
        guess,
        requestId,
      );
      if (receipt) return receipt;
    }
    const canonical = this.resolveGuess(guess);
    if (!canonical)
      return { error: 'Palavra não encontrada na lista de palavras válidas.' };
    if (date !== this.today()) return { error: cutoffMessage };
    try {
      return await this.database.transaction(async (tx) => {
        await lockGoalFactsForWrite(tx);
        await lockGlobalWordlePlayer(tx, userId, date);
        if (requestId) {
          const receipt = await this.readReceipt(
            tx,
            userId,
            date,
            guess,
            requestId,
          );
          if (receipt) return receipt;
        }
        if (date !== this.today()) return { error: cutoffMessage };
        // Share, not update: today's guesses read only the player's own rows
        // (serialized by the player lock), so players need not queue behind
        // each other. Draft finalization still locks the day exclusively.
        const [day] = await tx
          .select()
          .from(wordleGlobalDays)
          .where(eq(wordleGlobalDays.word_date, date))
          .for('share');
        if (!day) throw new Error('Global Wordle day is not initialized');
        if (canonical.length !== day.word_length)
          return {
            error: `A palavra de hoje tem ${day.word_length} letras. Sua tentativa tem ${canonical.length}.`,
          };
        const acceptedAt = this.now();
        const now = Math.floor(acceptedAt / 1000);
        await tx
          .insert(wordleGlobalSessions)
          .values({
            id: randomUUID(),
            user_id: userId,
            word_date: date,
            created_at: now,
          })
          .onConflictDoNothing();
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
        if (!session) throw new Error('Global Wordle session was not created');
        if (session.solved)
          return { error: 'Você já acertou a palavra de hoje!' };
        const previous = JSON.parse(session.guesses) as GuessRow[];
        const strippedGuess = stripDiacritics(canonical);
        if (
          previous.some((item) => stripDiacritics(item.guess) === strippedGuess)
        )
          return { error: 'Você já tentou essa palavra.' };
        let achievementBaseline: string[] | undefined;
        if (captureAchievementBaseline) {
          await lockWordleAchievements(tx, userId);
          const [global, legacy] = await Promise.all([
            tx
              .select({ id: wordleGlobalAchievements.achievement_id })
              .from(wordleGlobalAchievements)
              .where(eq(wordleGlobalAchievements.user_id, userId)),
            tx
              .select({ id: userAchievements.achievement_id })
              .from(userAchievements)
              .innerJoin(
                achievements,
                eq(userAchievements.achievement_id, achievements.id),
              )
              .where(
                and(
                  eq(userAchievements.user_id, userId),
                  eq(achievements.category, 'wordle'),
                ),
              ),
          ]);
          achievementBaseline = [
            ...new Set([...global, ...legacy].map((row) => row.id)),
          ];
        }
        const strippedWord = stripDiacritics(day.word);
        const feedback = computeFeedback(strippedGuess, strippedWord);
        const solved = strippedGuess === strippedWord;
        const guesses = [...previous, { guess: canonical, feedback }];
        const attempts = session.attempts + 1;
        await tx
          .update(wordleGlobalSessions)
          .set({
            guesses: JSON.stringify(guesses),
            solved,
            solved_at: solved ? now : null,
            attempts,
          })
          .where(eq(wordleGlobalSessions.id, session.id));
        await tx.insert(wordleGlobalAcceptedGuesses).values({
          session_id: session.id,
          user_id: userId,
          word_date: date,
          attempt: attempts,
          accepted_at: acceptedAt,
          request_id: requestId ?? null,
          achievement_baseline: achievementBaseline ?? null,
          achievement_guild_id: guildId ?? null,
        });
        if (solved) {
          const communities = await tx
            .select({ guildId: wordleCommunityDailyPresence.guild_id })
            .from(wordleCommunityDailyPresence)
            .where(
              and(
                eq(wordleCommunityDailyPresence.user_id, userId),
                eq(wordleCommunityDailyPresence.word_date, date),
                lte(wordleCommunityDailyPresence.first_seen_at, now),
              ),
            );
          if (communities.length > 0) {
            await tx
              .insert(wordleCommunityFirstSolves)
              .values(
                communities.map(({ guildId }) => ({
                  guild_id: guildId,
                  word_date: date,
                  user_id: userId,
                  session_id: session.id,
                  solved_at: now,
                })),
              )
              .onConflictDoNothing();
          }
        }
        const draftKey = and(
          eq(wordleGlobalDrafts.user_id, userId),
          eq(wordleGlobalDrafts.word_date, date),
        );
        if (solved) await tx.delete(wordleGlobalDrafts).where(draftKey);
        else
          await tx
            .insert(wordleGlobalDrafts)
            .values({
              user_id: userId,
              word_date: date,
              row_index: attempts,
              cells: Array(day.word_length).fill(''),
              active_index: 0,
              revision: 1,
              updated_at: now,
            })
            .onConflictDoUpdate({
              target: [
                wordleGlobalDrafts.user_id,
                wordleGlobalDrafts.word_date,
              ],
              set: {
                row_index: attempts,
                cells: Array(day.word_length).fill(''),
                active_index: 0,
                revision: sql`${wordleGlobalDrafts.revision} + 1`,
                updated_at: now,
                finalized_at: null,
                award_reconciled_at: null,
              },
            });
        if (date !== this.today()) throw new GlobalGameCutoff();
        return {
          guess: canonical,
          feedback,
          guesses,
          solved,
          attempts,
          wordLength: day.word_length,
          ...(requestId ? { requestId } : {}),
          ...(achievementBaseline ? { achievementBaseline } : {}),
        };
      });
    } catch (error) {
      if (error instanceof GlobalGameCutoff) return { error: cutoffMessage };
      throw error;
    }
  }

  async pendingAwards(userId?: string) {
    return this.database
      .select({
        sessionId: wordleGlobalAcceptedGuesses.session_id,
        attempt: wordleGlobalAcceptedGuesses.attempt,
        userId: wordleGlobalAcceptedGuesses.user_id,
        guildId: wordleGlobalAcceptedGuesses.achievement_guild_id,
      })
      .from(wordleGlobalAcceptedGuesses)
      .where(
        and(
          isNotNull(wordleGlobalAcceptedGuesses.achievement_guild_id),
          eq(wordleGlobalAcceptedGuesses.achievement_reconciled, false),
          userId
            ? undefined
            : lte(wordleGlobalAcceptedGuesses.achievement_retry_at, this.now()),
          userId ? eq(wordleGlobalAcceptedGuesses.user_id, userId) : undefined,
        ),
      )
      .orderBy(
        asc(wordleGlobalAcceptedGuesses.accepted_at),
        asc(wordleGlobalAcceptedGuesses.session_id),
        asc(wordleGlobalAcceptedGuesses.attempt),
      )
      .limit(100);
  }

  async markAwardReconciled(
    userId: string,
    date: string,
    attempt: number,
    requestId?: string,
  ) {
    await this.database
      .update(wordleGlobalAcceptedGuesses)
      .set({ achievement_reconciled: true })
      .where(
        and(
          eq(wordleGlobalAcceptedGuesses.user_id, userId),
          eq(wordleGlobalAcceptedGuesses.word_date, date),
          requestId
            ? eq(wordleGlobalAcceptedGuesses.request_id, requestId)
            : eq(wordleGlobalAcceptedGuesses.attempt, attempt),
        ),
      );
  }

  async finishPendingAward(
    sessionId: string,
    attempt: number,
    success: boolean,
  ) {
    await this.database
      .update(wordleGlobalAcceptedGuesses)
      .set(
        success
          ? { achievement_reconciled: true }
          : { achievement_retry_at: this.now() + 60_000 },
      )
      .where(
        and(
          eq(wordleGlobalAcceptedGuesses.session_id, sessionId),
          eq(wordleGlobalAcceptedGuesses.attempt, attempt),
          eq(wordleGlobalAcceptedGuesses.achievement_reconciled, false),
        ),
      );
  }
}
