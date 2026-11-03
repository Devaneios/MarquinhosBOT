import type { GuessRow } from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleCommunityFirstSolves,
  wordleGlobalAcceptedGuesses,
  wordleGlobalDays,
  wordleGlobalDrafts,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { computeFeedback } from '@marquinhos/domain/games/wordle/feedback';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { and, eq, lte, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { lockGlobalWordlePlayer } from './gameplayLock';
import { getWordleTimeZone } from './wordleDate';

class GlobalGameCutoff extends Error {}
export type GlobalGuessResult =
  | {
      guess: string;
      feedback: GuessRow['feedback'];
      guesses: GuessRow[];
      solved: boolean;
      attempts: number;
      wordLength: number;
    }
  | { error: string };
const cutoffMessage = 'O dia do jogo mudou. Envie o palpite novamente.';

export class WordleGlobalGameplayService {
  constructor(
    private readonly database: Db,
    private readonly resolveGuess: (guess: string) => string | null,
    private readonly now: () => number = Date.now,
  ) {}

  private today(): string {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: getWordleTimeZone(),
    }).format(new Date(this.now()));
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
  ): Promise<GlobalGuessResult> {
    const canonical = this.resolveGuess(guess);
    if (!canonical)
      return { error: 'Palavra não encontrada na lista de palavras válidas.' };
    if (date !== this.today()) return { error: cutoffMessage };
    try {
      return await this.database.transaction(async (tx) => {
        await lockGlobalWordlePlayer(tx, userId, date);
        if (date !== this.today()) return { error: cutoffMessage };
        const [day] = await tx
          .select()
          .from(wordleGlobalDays)
          .where(eq(wordleGlobalDays.word_date, date))
          .for('update');
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
        };
      });
    } catch (error) {
      if (error instanceof GlobalGameCutoff) return { error: cutoffMessage };
      throw error;
    }
  }
}
