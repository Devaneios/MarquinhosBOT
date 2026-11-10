import type {
  GuessRow,
  WordleDraft,
  WordleDraftWrite,
  WordleDraftWriteResult,
} from '@marquinhos/contracts/wordle';
import type { Db, DbExecutor } from '@marquinhos/database/client';
import {
  wordleDays,
  wordleDrafts,
  wordleSessions,
  wordleStreaks,
  wordleUsedWords,
} from '@marquinhos/database/schema';
import { computeFeedback } from '@marquinhos/domain/games/wordle/feedback';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DB } from 'database/database.tokens';
import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import type { WordleGameMode } from 'modules/wordle/modes/wordle-game-mode';
import {
  buildUniqueDayGuesses,
  type WordleSessionGuessesRow,
} from 'modules/wordle/services/day-guesses';
import {
  lockWordleDay,
  lockWordlePlayer,
} from 'modules/wordle/services/gameplay-lock';
import { updateWordleStreak } from 'modules/wordle/services/streaks';
import {
  DEVANEIOS_WEIGHT,
  WordBankService,
} from 'modules/wordle/services/word-bank.service';
import { WordleAchievementService } from 'modules/wordle/services/wordle-achievement.service';
import { WordleDraftService } from 'modules/wordle/services/wordle-draft.service';
import { WORDLE_NOW, WORDLE_TODAY } from 'modules/wordle/wordle.tokens';
import type {
  DayGuesses,
  ForceNewWordResult,
  GuessResult,
  WordleDaily,
  WordleSession,
} from './wordle-game-mode';

const logger = {
  warn: (...args: unknown[]) => console.warn('[wordle]', ...args),
};

class WordleCutoffPassed extends Error {}
const WORDLE_CUTOFF_ERROR = 'O dia do jogo mudou. Envie o palpite novamente.';
type PickMode = 'force' | 'ifStale';

@Injectable()
export class GuildWordleMode implements WordleGameMode {
  constructor(
    @Inject(DB) private readonly database: Db,
    private readonly wordBank: WordBankService,
    private readonly drafts: WordleDraftService,
    private readonly achievements: WordleAchievementService,
    @Inject(WORDLE_TODAY) private readonly today: () => string,
    @Inject(WORDLE_NOW) private readonly now: () => number,
  ) {}

  async getAchievementsOverview(
    userId: string,
    guildId: string,
    _viewerId: string,
  ) {
    return this.achievements.getOverview(userId, guildId);
  }

  async pickNewWord(
    guildId: string,
    wordDate: string,
    mode: PickMode = 'force',
  ): Promise<ForceNewWordResult> {
    const usedRows = await this.database
      .select({ word: wordleUsedWords.word })
      .from(wordleUsedWords);
    const usedSet = new Set(usedRows.map((r) => r.word));
    const bannedSet = await this.wordBank.getBannedWords();

    // Only pick words of reasonable length for playability
    const MIN_LENGTH = 5;
    const MAX_LENGTH = 6;
    const filterAvailable = (list: string[]) =>
      list.filter(
        (w) =>
          !usedSet.has(w) &&
          !bannedSet.has(w) &&
          w.length >= MIN_LENGTH &&
          w.length <= MAX_LENGTH,
      );

    const useDevaneios = Math.random() < DEVANEIOS_WEIGHT;
    const primary = useDevaneios
      ? this.wordBank.getDevaneiosWordlist()
      : this.wordBank.getAnswerWordlist();
    const fallback = useDevaneios
      ? this.wordBank.getAnswerWordlist()
      : this.wordBank.getDevaneiosWordlist();

    let available = filterAvailable(primary);
    if (available.length === 0) {
      available = filterAvailable(fallback);
    }

    if (available.length === 0) {
      throw new Error('No available words left in the wordlist');
    }

    if (available.length < 50) {
      logger.warn(`Low word pool: only ${available.length} words remaining`);
    }

    // Group by length and pick a length uniformly, then a word within that group.
    // This ensures balanced distribution across word lengths over time.
    const byLength = new Map<number, string[]>();
    for (const w of available) {
      const len = w.length;
      if (!byLength.has(len)) byLength.set(len, []);
      byLength.get(len)!.push(w);
    }
    const lengths = Array.from(byLength.keys());
    const chosenLength = lengths[Math.floor(Math.random() * lengths.length)];
    const pool =
      chosenLength !== undefined ? byLength.get(chosenLength) : undefined;
    const word = pool?.[Math.floor(Math.random() * pool.length)];
    if (word === undefined) {
      throw new Error('No available words left in the wordlist');
    }
    const now = Math.floor(this.now() / 1000);

    return this.database.transaction(async (tx) => {
      const inserted = await tx
        .insert(wordleDays)
        .values({
          guild_id: guildId,
          word_date: wordDate,
          word,
          word_length: word.length,
          is_legacy: false,
          created_at: now,
        })
        .onConflictDoNothing()
        .returning({ word: wordleDays.word });

      // The day already existed: adopt its word, or replace it (force, or a
      // legacy day that never had one).
      if (inserted.length === 0) {
        const [current] = await tx
          .select()
          .from(wordleDays)
          .where(
            and(
              eq(wordleDays.guild_id, guildId),
              eq(wordleDays.word_date, wordDate),
            ),
          )
          .for('update');

        if (!current) throw new Error('Failed to initialize Wordle day');
        if (mode === 'ifStale' && current.word !== null) {
          return {
            word: current.word,
            wordDate,
            wordLength: current.word_length!,
          };
        }

        if (mode === 'force') {
          await tx
            .delete(wordleSessions)
            .where(
              and(
                eq(wordleSessions.guild_id, guildId),
                eq(wordleSessions.word_date, wordDate),
              ),
            );
          await tx
            .delete(wordleDrafts)
            .where(
              and(
                eq(wordleDrafts.guild_id, guildId),
                eq(wordleDrafts.word_date, wordDate),
              ),
            );
        }

        await tx
          .update(wordleDays)
          .set({
            word,
            word_length: word.length,
            is_legacy: false,
            players_count: 0,
            winners_count: 0,
            total_attempts: 0,
            created_at: now,
          })
          .where(
            and(
              eq(wordleDays.guild_id, guildId),
              eq(wordleDays.word_date, wordDate),
            ),
          );
      }

      await tx
        .insert(wordleUsedWords)
        .values({ word, used_at: now })
        .onConflictDoUpdate({
          target: wordleUsedWords.word,
          set: { used_at: now },
        });

      return { word, wordDate, wordLength: word.length };
    });
  }

  async getDailyWord(
    guildId: string,
    today: string = this.today(),
  ): Promise<WordleDaily> {
    let row = await this.findDaily(guildId, today);
    if (!row || row.word === null || row.word_length === null) {
      await this.pickNewWord(guildId, today, 'ifStale');
      row = await this.findDaily(guildId, today);
    }
    if (!row?.word || !row.word_length) {
      throw new Error(`Wordle day ${guildId}/${today} has no playable word`);
    }
    return { ...row, word: row.word, word_length: row.word_length };
  }

  private async findDaily(guildId: string, wordDate: string) {
    const [row] = await this.database
      .select()
      .from(wordleDays)
      .where(
        and(
          eq(wordleDays.guild_id, guildId),
          eq(wordleDays.word_date, wordDate),
        ),
      );
    return row;
  }

  async submitGuess(
    userId: string,
    guildId: string,
    guess: string,
  ): Promise<GuessResult | { error: string }> {
    const canonicalGuess = this.wordBank.resolveCanonical(guess);
    if (!canonicalGuess) {
      return { error: 'Palavra não encontrada na lista de palavras válidas.' };
    }

    const strippedGuess = stripDiacritics(canonicalGuess);
    const today = this.today();
    await this.drafts.finalizePlayerBefore(userId, guildId, today);
    // Initialize before reserving a guess connection: word selection reads
    // through the pool and must also work when it has only one connection.
    await this.getDailyWord(guildId, today);
    if (this.today() !== today) return { error: WORDLE_CUTOFF_ERROR };
    const now = Math.floor(this.now() / 1000);

    let outcome: GuessResult | { error: string };
    try {
      outcome = await this.database.transaction(async (tx) => {
        await lockWordlePlayer(tx, userId, guildId);
        if (this.today() !== today) return { error: WORDLE_CUTOFF_ERROR };
        await lockWordleDay(tx, guildId, today);
        if (this.today() !== today) return { error: WORDLE_CUTOFF_ERROR };
        const [daily] = await tx
          .select()
          .from(wordleDays)
          .where(
            and(
              eq(wordleDays.guild_id, guildId),
              eq(wordleDays.word_date, today),
            ),
          )
          .for('update');
        if (!daily?.word || !daily.word_length) {
          throw new Error(
            `Wordle day ${guildId}/${today} has no playable word`,
          );
        }
        if (this.today() !== today) return { error: WORDLE_CUTOFF_ERROR };
        if (canonicalGuess.length !== daily.word_length) {
          return {
            error: `A palavra de hoje tem ${daily.word_length} letras. Sua tentativa tem ${canonicalGuess.length}.`,
          };
        }
        const strippedWord = stripDiacritics(daily.word);

        // The row must exist before it can be locked: create an empty session
        // unless one is already there, then lock it for the read-modify-write.
        // A concurrent first guess waits here instead of failing on the
        // unique key.
        await tx
          .insert(wordleSessions)
          .values({
            id: randomUUID(),
            user_id: userId,
            guild_id: guildId,
            word_date: today,
            guesses: '[]',
            solved: false,
            attempts: 0,
            created_at: now,
          })
          .onConflictDoNothing();
        const [sessionRow] = await tx
          .select({
            id: wordleSessions.id,
            guesses: wordleSessions.guesses,
            solved: wordleSessions.solved,
            attempts: wordleSessions.attempts,
          })
          .from(wordleSessions)
          .where(sessionOf(userId, guildId, today))
          .for('update');
        if (this.today() !== today) throw new WordleCutoffPassed();
        const session = sessionRow!;

        if (session.solved) {
          return { error: 'Você já acertou a palavra de hoje!' };
        }

        const previousGuesses: GuessRow[] = JSON.parse(session.guesses);

        if (
          previousGuesses.some(
            (g) => stripDiacritics(g.guess) === strippedGuess,
          )
        ) {
          return { error: 'Você já tentou essa palavra.' };
        }

        const feedback = computeFeedback(strippedGuess, strippedWord);
        const solved = strippedGuess === strippedWord;
        const newGuesses = [
          ...previousGuesses,
          { guess: canonicalGuess, feedback },
        ];
        const newAttempts = session.attempts + 1;
        const sessionId = session.id;

        await tx
          .update(wordleSessions)
          .set({
            guesses: JSON.stringify(newGuesses),
            solved,
            solved_at: solved ? now : null,
            attempts: newAttempts,
          })
          .where(eq(wordleSessions.id, sessionId));

        if (solved) {
          await tx
            .delete(wordleDrafts)
            .where(
              and(
                eq(wordleDrafts.user_id, userId),
                eq(wordleDrafts.guild_id, guildId),
                eq(wordleDrafts.word_date, today),
              ),
            );
        } else {
          await tx
            .insert(wordleDrafts)
            .values({
              user_id: userId,
              guild_id: guildId,
              word_date: today,
              row_index: newAttempts,
              cells: Array(daily.word_length).fill(''),
              active_index: 0,
              revision: 1,
              updated_at: now,
            })
            .onConflictDoUpdate({
              target: [
                wordleDrafts.user_id,
                wordleDrafts.guild_id,
                wordleDrafts.word_date,
              ],
              set: {
                row_index: newAttempts,
                cells: Array(daily.word_length).fill(''),
                active_index: 0,
                revision: sql`${wordleDrafts.revision} + 1`,
                updated_at: now,
                finalized_at: null,
                award_reconciled_at: null,
              },
            });
        }

        // Update daily stats.
        // players_count is incremented exactly once per user per day: on their first guess,
        // regardless of whether that guess solves the puzzle. The previous CASE WHEN expression
        // caused a bug where a user who solved on a later guess never incremented players_count
        // (previousGuesses.length > 0 → $is_new_player = 0).
        const isNewPlayer = previousGuesses.length === 0;
        if (isNewPlayer || solved) {
          await tx
            .update(wordleDays)
            .set({
              ...(isNewPlayer
                ? { players_count: sql`${wordleDays.players_count} + 1` }
                : {}),
              ...(solved
                ? {
                    winners_count: sql`${wordleDays.winners_count} + 1`,
                    total_attempts: sql`${wordleDays.total_attempts} + ${newAttempts}`,
                  }
                : {}),
            })
            .where(
              and(
                eq(wordleDays.guild_id, guildId),
                eq(wordleDays.word_date, today),
              ),
            );
          if (solved) {
            // Decided from the sessions, not winners_count: the day-row lock
            // serialises solvers, and the counter can drift (backfills, deletions).
            await tx
              .update(wordleSessions)
              .set({
                first_solver: sql`NOT EXISTS (
                SELECT 1 FROM wordle_sessions other
                WHERE other.guild_id = ${guildId} AND other.word_date = ${today}
                  AND other.first_solver AND other.id <> ${sessionId}
              )`,
              })
              .where(eq(wordleSessions.id, sessionId));
          }
        }

        const result: GuessResult = {
          guess: canonicalGuess,
          feedback,
          guesses: newGuesses,
          solved,
          attempts: newAttempts,
          wordLength: daily.word_length,
        };

        if (solved) {
          result.streak = await this.updateStreak(userId, guildId, tx);
        }

        if (this.today() !== today) throw new WordleCutoffPassed();

        return result;
      });
    } catch (error) {
      if (error instanceof WordleCutoffPassed)
        return { error: WORDLE_CUTOFF_ERROR };
      throw error;
    }
    if ('error' in outcome) return outcome;

    // Best-effort, after the guess commits: a failure here must not lose the
    // guess. Anything missed is awarded by the next evaluation or the backfill
    // script, since checkAndAward awards every met-but-unearned achievement.
    try {
      const achievements = await this.database.transaction((tx) =>
        this.achievements.checkAndAward(userId, guildId, tx),
      );
      outcome.achievementUpdate = achievements;
    } catch (error) {
      logger.warn('wordle.achievements.award_failed', { error });
    }
    return outcome;
  }

  async getUserSession(
    userId: string,
    guildId: string,
  ): Promise<WordleSession | null> {
    const today = this.today();
    const [row] = await this.database
      .select({
        id: wordleSessions.id,
        guesses: wordleSessions.guesses,
        solved: wordleSessions.solved,
        solved_from_draft: wordleSessions.solved_from_draft,
        attempts: wordleSessions.attempts,
        created_at: wordleSessions.created_at,
      })
      .from(wordleSessions)
      .where(sessionOf(userId, guildId, today));

    if (!row) return null;

    return {
      id: row.id,
      user_id: userId,
      guild_id: guildId,
      word_date: today,
      guesses: JSON.parse(row.guesses),
      solved: row.solved,
      solved_from_draft: row.solved_from_draft,
      attempts: row.attempts,
      created_at: row.created_at,
    };
  }

  async markAnnounced(userId: string, guildId: string): Promise<boolean> {
    const today = this.today();
    const now = Math.floor(this.now() / 1000);
    const claimed = await this.database
      .update(wordleSessions)
      .set({ announced_at: now })
      .where(
        and(
          sessionOf(userId, guildId, today),
          eq(wordleSessions.solved, true),
          isNull(wordleSessions.announced_at),
        ),
      )
      .returning({ id: wordleSessions.id });
    return claimed.length > 0;
  }

  async getUnannouncedWins(guildId: string): Promise<
    {
      userId: string;
      guesses: GuessRow[];
      attempts: number;
    }[]
  > {
    const today = this.today();
    const rows = await this.database
      .select({
        user_id: wordleSessions.user_id,
        guesses: wordleSessions.guesses,
        attempts: wordleSessions.attempts,
      })
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.guild_id, guildId),
          eq(wordleSessions.word_date, today),
          eq(wordleSessions.solved, true),
          isNull(wordleSessions.announced_at),
        ),
      );

    return rows.map((row) => ({
      userId: row.user_id,
      guesses: JSON.parse(row.guesses),
      attempts: row.attempts,
    }));
  }

  async getDayGuesses(
    guildId: string,
    date = this.today(),
  ): Promise<DayGuesses | null> {
    const daily = await this.findDaily(guildId, date);

    if (!daily?.word || !daily.word_length) return null;

    const rows: WordleSessionGuessesRow[] = await this.database
      .select({ guesses: wordleSessions.guesses })
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.guild_id, guildId),
          eq(wordleSessions.word_date, daily.word_date),
        ),
      )
      .orderBy(asc(wordleSessions.created_at));

    return {
      word: daily.word,
      wordDate: daily.word_date,
      wordLength: daily.word_length,
      guesses: buildUniqueDayGuesses(daily.word, rows),
    };
  }

  private getYesterday(today: string): string {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  private async computeStreakFromHistory(
    userId: string,
    guildId: string,
    today: string,
    exec: DbExecutor = this.database,
  ): Promise<number> {
    const rows = await exec
      .select({ word_date: wordleSessions.word_date })
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.user_id, userId),
          eq(wordleSessions.guild_id, guildId),
          eq(wordleSessions.solved, true),
          or(
            gt(wordleSessions.attempts, 0),
            eq(wordleSessions.solved_from_draft, true),
          ),
        ),
      )
      .orderBy(desc(wordleSessions.word_date));

    if (rows.length === 0) return 0;

    let streak = 0;
    let expectedDate = today;

    for (const row of rows) {
      if (row.word_date === expectedDate) {
        streak++;
        expectedDate = this.getYesterday(expectedDate);
      } else {
        break;
      }
    }

    return streak;
  }

  private async findStreak(
    userId: string,
    guildId: string,
    exec: DbExecutor = this.database,
  ) {
    const [row] = await exec
      .select({
        current_streak: wordleStreaks.current_streak,
        max_streak: wordleStreaks.max_streak,
        last_solved_date: wordleStreaks.last_solved_date,
      })
      .from(wordleStreaks)
      .where(
        and(
          eq(wordleStreaks.user_id, userId),
          eq(wordleStreaks.guild_id, guildId),
        ),
      );
    return row;
  }

  async updateStreak(
    userId: string,
    guildId: string,
    exec: DbExecutor = this.database,
  ): Promise<number> {
    return updateWordleStreak(userId, guildId, exec);
  }

  getCurrentDraft(
    userId: string,
    guildId: string,
    attempts: number,
  ): Promise<WordleDraft | null> {
    return this.drafts.getCurrentDraft(
      userId,
      guildId,
      this.today(),
      attempts,
      false,
    );
  }

  async writeDraft(
    userId: string,
    guildId: string,
    draft: WordleDraftWrite,
  ): Promise<WordleDraftWriteResult> {
    await this.getDailyWord(guildId, draft.date);
    return this.drafts.write(userId, guildId, draft);
  }

  async finalizeExpiredDrafts(): Promise<void> {
    await this.drafts.finalizeExpiredDrafts();
  }

  async getStreak(
    userId: string,
    guildId: string,
  ): Promise<{ currentStreak: number; maxStreak: number }> {
    const row = await this.findStreak(userId, guildId);

    if (!row) {
      const today = this.today();
      const streak = await this.computeStreakFromHistory(
        userId,
        guildId,
        today,
      );
      return { currentStreak: streak, maxStreak: streak };
    }

    const today = this.today();
    const yesterday = this.getYesterday(today);

    if (row.last_solved_date !== today && row.last_solved_date !== yesterday) {
      return { currentStreak: 0, maxStreak: row.max_streak };
    }

    return {
      currentStreak: row.current_streak,
      maxStreak: row.max_streak,
    };
  }

  async getLeaderboard(
    guildId: string,
    limit = 10,
    period: 'all-time' | 'weekly' | 'monthly' | 'daily' = 'all-time',
    date?: string,
    offset = 0,
  ): Promise<
    | { userId: string; totalDays: number; avgScore: number }[]
    | { userId: string; attempts: number; solved: boolean }[]
  > {
    if (period === 'daily') {
      const wordDate = date ?? this.today();
      const rows = await this.database
        .select({
          user_id: wordleSessions.user_id,
          attempts: wordleSessions.attempts,
          solved: wordleSessions.solved,
        })
        .from(wordleSessions)
        .where(
          and(
            eq(wordleSessions.guild_id, guildId),
            eq(wordleSessions.word_date, wordDate),
          ),
        )
        .orderBy(
          desc(wordleSessions.solved),
          asc(wordleSessions.attempts),
          asc(wordleSessions.created_at),
          asc(wordleSessions.user_id),
        )
        .limit(limit)
        .offset(offset);
      return rows.map((row) => ({
        userId: row.user_id,
        attempts: row.attempts,
        solved: row.solved,
      }));
    }

    let dateFrom: string | null = null;
    if (period === 'weekly') {
      const today = this.today();
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() - 6);
      dateFrom = d.toISOString().slice(0, 10);
    } else if (period === 'monthly') {
      dateFrom = `${this.today().substring(0, 8)}01`;
    }

    const sessionDateFilter = dateFrom
      ? sql`AND word_date >= ${dateFrom}`
      : sql``;
    const dayDateFilter = dateFrom
      ? sql`AND d.word_date >= ${dateFrom}`
      : sql``;

    const rows = await this.database.execute<{
      user_id: string;
      total_days: number;
      avg_score: number;
    }>(sql`
      SELECT
        p.user_id,
        COUNT(d.word_date)::int AS total_days,
        ROUND(
          SUM(COALESCE(s.attempts, d.word_length + 1))::numeric / COUNT(d.word_date),
          2
        )::float8 AS avg_score
      FROM (
        SELECT DISTINCT user_id FROM wordle_sessions
        WHERE guild_id = ${guildId} ${sessionDateFilter}
      ) p
      CROSS JOIN (
        SELECT d.word_date, d.word_length
        FROM wordle_days d
        WHERE d.guild_id = ${guildId}
          AND d.word_length > 0
          AND EXISTS (
            SELECT 1 FROM wordle_sessions s
            WHERE s.guild_id = d.guild_id AND s.word_date = d.word_date
          )
          ${dayDateFilter}
      ) d
      LEFT JOIN wordle_sessions s
        ON s.user_id = p.user_id
        AND s.guild_id = ${guildId}
        AND s.word_date = d.word_date
      GROUP BY p.user_id
      ORDER BY avg_score ASC, p.user_id ASC
      LIMIT ${limit} OFFSET ${offset}`);

    return rows.map((row) => ({
      userId: row.user_id,
      totalDays: row.total_days,
      avgScore: row.avg_score,
    }));
  }

  async getGroupStreak(guildId: string): Promise<number> {
    const today = this.today();
    const yesterday = this.getYesterday(today);

    const rows = await this.database
      .selectDistinct({ word_date: wordleSessions.word_date })
      .from(wordleSessions)
      .where(eq(wordleSessions.guild_id, guildId))
      .orderBy(desc(wordleSessions.word_date));

    if (rows.length === 0) return 0;

    let streak = 0;
    let expectedDate = yesterday;

    for (const row of rows) {
      if (row.word_date === today) continue;
      if (row.word_date === expectedDate) {
        streak++;
        expectedDate = this.getYesterday(expectedDate);
      } else {
        break;
      }
    }

    return streak;
  }

  async forceNewWord(guildId: string): Promise<ForceNewWordResult> {
    const today = this.today();
    return this.pickNewWord(guildId, today, 'force');
  }

  async rotateDailyWord(guildId: string): Promise<ForceNewWordResult> {
    return this.forceNewWord(guildId);
  }
}

function sessionOf(userId: string, guildId: string, wordDate: string) {
  return and(
    eq(wordleSessions.user_id, userId),
    eq(wordleSessions.guild_id, guildId),
    eq(wordleSessions.word_date, wordDate),
  );
}
