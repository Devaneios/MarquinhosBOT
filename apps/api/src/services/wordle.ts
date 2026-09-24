import type {
  forceNewWordResultSchema,
  wordleDailyStatsSchema,
  wordleDayGuessesSchema,
  wordleGuessResultSchema,
  wordleReviewWordResultSchema,
  wordleSessionSchema,
} from '@marquinhos/contracts/http/routes/wordle';
import type { GuessRow } from '@marquinhos/contracts/wordle';
import { db, type DbExecutor } from '@marquinhos/database/client';
import {
  wordleConfig,
  wordleDaily,
  wordleSessions,
  wordleStreaks,
  wordleUsedWords,
  wordlistReview,
} from '@marquinhos/database/schema';
import { computeFeedback } from '@marquinhos/domain/games/wordle/feedback';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { randomUUID } from 'crypto';
import { and, asc, count, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildUniqueDayGuesses,
  type WordleSessionGuessesRow,
} from 'services/wordle/dayGuesses';
import type { z } from 'zod';

const logger = {
  warn: (...args: unknown[]) => console.warn('[wordle]', ...args),
};

interface WordleDaily {
  guild_id: string;
  word: string;
  word_date: string;
  players_count: number;
  winners_count: number;
  total_attempts: number;
  created_at: number;
}

type WordleSession = z.input<typeof wordleSessionSchema>;

export type GuessResult = z.input<typeof wordleGuessResultSchema>;

export type DailyStats = z.input<typeof wordleDailyStatsSchema>;

export type ForceNewWordResult = z.input<typeof forceNewWordResultSchema>;

export type DayGuesses = z.input<typeof wordleDayGuessesSchema>;

export type ReviewWordResult = z.input<typeof wordleReviewWordResultSchema>;

// Answer bank: wordlist.txt (used for picking daily words)
const WORDLIST_PATH = join(__dirname, '../../wordlist.txt');
let wordlistCache: string[] | null = null;

function getWordlist(): string[] {
  if (wordlistCache) return wordlistCache;
  const raw = readFileSync(WORDLIST_PATH, 'utf-8');
  wordlistCache = raw
    .split('\n')
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
  return wordlistCache;
}

// Alternative answer bank: devaneios-wordlist.txt (picked DEVANEIOS_WEIGHT of the time, see pickNewWord)
const DEVANEIOS_WORDLIST_PATH = join(__dirname, '../../devaneios-wordlist.txt');
let devaneiosWordlistCache: string[] | null = null;

function getDevaneiosWordlist(): string[] {
  if (devaneiosWordlistCache) return devaneiosWordlistCache;
  const raw = readFileSync(DEVANEIOS_WORDLIST_PATH, 'utf-8');
  devaneiosWordlistCache = raw
    .split('\n')
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
  return devaneiosWordlistCache;
}

const DEVANEIOS_WEIGHT = 0.75;

// Validation bank: valid-guesses.txt (pre-built union of wordlist + ICF, 5–12 chars)
const VALID_GUESSES_PATH = join(__dirname, '../../valid-guesses.txt');
let validationSetCache: Set<string> | null = null;
let validationByStrippedCache: Map<string, string> | null = null;

function hasDiacritics(s: string): boolean {
  return stripDiacritics(s) !== s;
}

function loadValidationBank(): void {
  if (validationSetCache && validationByStrippedCache) return;
  const raw = readFileSync(VALID_GUESSES_PATH, 'utf-8');
  const words = raw
    .split('\n')
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  const set = new Set(words);
  const byStripped = new Map<string, string>();
  for (const w of words) {
    const key = stripDiacritics(w);
    const existing = byStripped.get(key);
    // Prefer entries with diacritics when a collision occurs so that
    // unaccented inputs resolve to the canonical accented spelling.
    if (!existing || (!hasDiacritics(existing) && hasDiacritics(w))) {
      byStripped.set(key, w);
    }
  }

  validationSetCache = set;
  validationByStrippedCache = byStripped;
}

export function getValidationSet(): Set<string> {
  loadValidationBank();
  return validationSetCache!;
}

export function resolveCanonical(guess: string): string | null {
  loadValidationBank();
  const normalized = guess.trim().toLowerCase();
  if (!normalized) return null;
  if (validationSetCache!.has(normalized)) return normalized;
  const canonical = validationByStrippedCache!.get(stripDiacritics(normalized));
  return canonical ?? null;
}

const RACE_WORD_LENGTH = 5;

// Wordle Race draws from the curated daily bank, minus words the review
// banned. A race is won only by a guess whose canonical spelling equals the
// target, so the target is the canonical spelling too.
// Race sessions are built synchronously inside MatchRoom, so they read the ban
// list from memory. This process is the only writer (submitReviewDecision),
// and loadBannedWords() primes it at startup.
let bannedWordsCache = new Set<string>();

export async function loadBannedWords(): Promise<void> {
  bannedWordsCache = await getBannedWords();
}

export function pickRaceWord(): string {
  const banned = bannedWordsCache;
  const candidates = getDevaneiosWordlist().flatMap((word) => {
    if (word.length !== RACE_WORD_LENGTH || banned.has(word)) return [];
    const canonical = resolveCanonical(word);
    return canonical ? [canonical] : [];
  });
  if (candidates.length === 0) throw new Error('No Wordle Race words left');
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

async function getBannedWords(): Promise<Set<string>> {
  const rows = await db
    .select({ word: wordlistReview.word })
    .from(wordlistReview)
    .where(eq(wordlistReview.is_banned, true));
  return new Set(rows.map((row) => row.word));
}

// Keeps each multi-row insert well under Postgres' 65535 bind-parameter cap.
const REVIEW_SEED_BATCH_SIZE = 5_000;

/** `ifStale` keeps a word another caller already picked for `wordDate`. */
type PickMode = 'force' | 'ifStale';

function getRecifeDate(): string {
  // Use Intl to get the correct date in Recife timezone
  const tz = process.env.WORDLE_TIMEZONE ?? 'America/Recife';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
  // 'sv-SE' locale gives YYYY-MM-DD format
}

export class WordleService {
  async pickNewWord(
    guildId: string,
    wordDate: string,
    mode: PickMode = 'force',
  ): Promise<ForceNewWordResult> {
    const usedRows = await db
      .select({ word: wordleUsedWords.word })
      .from(wordleUsedWords);
    const usedSet = new Set(usedRows.map((r) => r.word));
    const bannedSet = await getBannedWords();

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
    const primary = useDevaneios ? getDevaneiosWordlist() : getWordlist();
    const fallback = useDevaneios ? getWordlist() : getDevaneiosWordlist();

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
    const now = Math.floor(Date.now() / 1000);

    return db.transaction(async (tx) => {
      const fresh = {
        guild_id: guildId,
        word,
        word_date: wordDate,
        players_count: 0,
        winners_count: 0,
        total_attempts: 0,
        created_at: now,
      };
      const { guild_id: _guildId, ...replacement } = fresh;
      // In `ifStale` mode two concurrent joins race here; the WHERE lets only
      // the first replace yesterday's row, and the loser adopts its word.
      const written = await tx
        .insert(wordleDaily)
        .values(fresh)
        .onConflictDoUpdate({
          target: wordleDaily.guild_id,
          set: replacement,
          ...(mode === 'ifStale'
            ? { setWhere: ne(wordleDaily.word_date, wordDate) }
            : {}),
        })
        .returning({ word: wordleDaily.word });

      if (written.length === 0) {
        const [current] = await tx
          .select()
          .from(wordleDaily)
          .where(eq(wordleDaily.guild_id, guildId));
        return {
          word: current!.word,
          wordDate: current!.word_date,
          wordLength: current!.word.length,
        };
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

  async getDailyWord(guildId: string): Promise<WordleDaily> {
    const today = getRecifeDate();
    const row = await this.findDaily(guildId);

    if (!row || row.word_date !== today) {
      // Lazy init: pick a new word for today
      await this.pickNewWord(guildId, today, 'ifStale');
      return (await this.findDaily(guildId))!;
    }

    return row;
  }

  private async findDaily(guildId: string): Promise<WordleDaily | undefined> {
    const [row] = await db
      .select()
      .from(wordleDaily)
      .where(eq(wordleDaily.guild_id, guildId));
    return row;
  }

  async submitGuess(
    userId: string,
    guildId: string,
    guess: string,
  ): Promise<GuessResult | { error: string }> {
    const canonicalGuess = resolveCanonical(guess);
    if (!canonicalGuess) {
      return { error: 'Palavra não encontrada na lista de palavras válidas.' };
    }

    const daily = await this.getDailyWord(guildId);

    // Validate length matches today's word
    if (canonicalGuess.length !== daily.word.length) {
      return {
        error: `A palavra de hoje tem ${daily.word.length} letras. Sua tentativa tem ${canonicalGuess.length}.`,
      };
    }

    const strippedGuess = stripDiacritics(canonicalGuess);
    const strippedWord = stripDiacritics(daily.word);

    const today = getRecifeDate();
    const now = Math.floor(Date.now() / 1000);

    return db.transaction(async (tx) => {
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
          word_length: daily.word.length,
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
      const session = sessionRow!;

      if (session.solved) {
        return { error: 'Você já acertou a palavra de hoje!' };
      }

      const previousGuesses: GuessRow[] = JSON.parse(session.guesses);

      if (
        previousGuesses.some((g) => stripDiacritics(g.guess) === strippedGuess)
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
          attempts: newAttempts,
        })
        .where(eq(wordleSessions.id, sessionId));

      // Update daily stats.
      // players_count is incremented exactly once per user per day: on their first guess,
      // regardless of whether that guess solves the puzzle. The previous CASE WHEN expression
      // caused a bug where a user who solved on a later guess never incremented players_count
      // (previousGuesses.length > 0 → $is_new_player = 0).
      const isNewPlayer = previousGuesses.length === 0;
      if (isNewPlayer || solved) {
        await tx
          .update(wordleDaily)
          .set({
            ...(isNewPlayer
              ? { players_count: sql`${wordleDaily.players_count} + 1` }
              : {}),
            ...(solved
              ? {
                  winners_count: sql`${wordleDaily.winners_count} + 1`,
                  total_attempts: sql`${wordleDaily.total_attempts} + ${newAttempts}`,
                }
              : {}),
          })
          .where(eq(wordleDaily.guild_id, guildId));
      }

      const result: GuessResult = {
        guess: canonicalGuess,
        feedback,
        guesses: newGuesses,
        solved,
        attempts: newAttempts,
        wordLength: daily.word.length,
      };

      if (solved) {
        result.streak = await this.updateStreak(userId, guildId, tx);
      }

      return result;
    });
  }

  async getUserSession(
    userId: string,
    guildId: string,
  ): Promise<WordleSession | null> {
    const today = getRecifeDate();
    const [row] = await db
      .select({
        id: wordleSessions.id,
        guesses: wordleSessions.guesses,
        solved: wordleSessions.solved,
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
      attempts: row.attempts,
      created_at: row.created_at,
    };
  }

  // Atomically claims the right to announce this win: only the first
  // caller (the /termo command's synchronous send, or the poller racing
  // it) gets `claimed: true` back, since the WHERE clause only matches a
  // row that hasn't been claimed yet. Callers must claim *before* building
  // and sending the announcement, not after — claiming after sending still
  // leaves a window where both the command and the poller can observe the
  // win as unannounced and both send it.
  async markAnnounced(userId: string, guildId: string): Promise<boolean> {
    const today = getRecifeDate();
    const now = Math.floor(Date.now() / 1000);
    const claimed = await db
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
    const today = getRecifeDate();
    const rows = await db
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

  async validateGuess(
    guildId: string,
    guess: string,
  ): Promise<{ valid: boolean; wordLength: number; message: string }> {
    const normalized = guess.trim().toLowerCase();
    const daily = await this.getDailyWord(guildId);

    if (normalized.length !== daily.word.length) {
      return {
        valid: false,
        wordLength: daily.word.length,
        message: `A palavra de hoje tem ${daily.word.length} letras (você digitou ${normalized.length})`,
      };
    }

    const canonical = resolveCanonical(normalized);
    return {
      valid: canonical !== null,
      wordLength: daily.word.length,
      message: canonical
        ? `"${canonical}" é uma palavra válida`
        : `"${normalized}" não está na lista de palavras válidas`,
    };
  }

  async getDailyStats(guildId: string): Promise<DailyStats> {
    const daily = await this.getDailyWord(guildId);
    const avgAttempts =
      daily.winners_count > 0
        ? Math.round((daily.total_attempts / daily.winners_count) * 10) / 10
        : 0;

    return {
      wordDate: daily.word_date,
      wordLength: daily.word.length,
      playersCount: daily.players_count,
      winnersCount: daily.winners_count,
      avgAttempts,
    };
  }

  async getDayGuesses(guildId: string): Promise<DayGuesses | null> {
    const daily = await this.findDaily(guildId);

    if (!daily) return null;

    const rows: WordleSessionGuessesRow[] = await db
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
      wordLength: daily.word.length,
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
    exec: DbExecutor = db,
  ): Promise<number> {
    const rows = await exec
      .select({ word_date: wordleSessions.word_date })
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.user_id, userId),
          eq(wordleSessions.guild_id, guildId),
          eq(wordleSessions.solved, true),
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
    exec: DbExecutor = db,
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
    exec: DbExecutor = db,
  ): Promise<number> {
    const today = getRecifeDate();

    const row = await this.findStreak(userId, guildId, exec);

    if (!row) {
      const streak = await this.computeStreakFromHistory(
        userId,
        guildId,
        today,
        exec,
      );
      await exec.insert(wordleStreaks).values({
        user_id: userId,
        guild_id: guildId,
        current_streak: streak,
        max_streak: streak,
        last_solved_date: today,
      });
      return streak;
    }

    if (row.last_solved_date === today) {
      return row.current_streak;
    }

    const yesterday = this.getYesterday(today);
    let newStreak: number;

    if (row.last_solved_date === yesterday) {
      newStreak = row.current_streak + 1;
    } else {
      newStreak = 1;
    }

    const newMax = Math.max(newStreak, row.max_streak);

    await exec
      .update(wordleStreaks)
      .set({
        current_streak: newStreak,
        max_streak: newMax,
        last_solved_date: today,
      })
      .where(
        and(
          eq(wordleStreaks.user_id, userId),
          eq(wordleStreaks.guild_id, guildId),
        ),
      );

    return newStreak;
  }

  async getStreak(
    userId: string,
    guildId: string,
  ): Promise<{ currentStreak: number; maxStreak: number }> {
    const row = await this.findStreak(userId, guildId);

    if (!row) {
      const today = getRecifeDate();
      const streak = await this.computeStreakFromHistory(
        userId,
        guildId,
        today,
      );
      return { currentStreak: streak, maxStreak: streak };
    }

    const today = getRecifeDate();
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
  ): Promise<
    | { userId: string; totalDays: number; avgScore: number }[]
    | { userId: string; attempts: number; solved: boolean }[]
  > {
    if (period === 'daily') {
      const wordDate = date ?? getRecifeDate();
      const rows = await db
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
        )
        .limit(limit);
      return rows.map((row) => ({
        userId: row.user_id,
        attempts: row.attempts,
        solved: row.solved,
      }));
    }

    let dateFrom: string | null = null;
    if (period === 'weekly') {
      const today = getRecifeDate();
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() - 6);
      dateFrom = d.toISOString().slice(0, 10);
    } else if (period === 'monthly') {
      dateFrom = `${getRecifeDate().substring(0, 8)}01`;
    }

    const dateFilter = dateFrom ? sql`AND word_date >= ${dateFrom}` : sql``;

    const rows = await db.execute<{
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
        WHERE guild_id = ${guildId} ${dateFilter}
      ) p
      CROSS JOIN (
        SELECT DISTINCT word_date, word_length
        FROM wordle_sessions
        WHERE guild_id = ${guildId} AND word_length > 0 ${dateFilter}
      ) d
      LEFT JOIN wordle_sessions s
        ON s.user_id = p.user_id
        AND s.guild_id = ${guildId}
        AND s.word_date = d.word_date
      GROUP BY p.user_id
      ORDER BY avg_score ASC
      LIMIT ${limit}`);

    return rows.map((row) => ({
      userId: row.user_id,
      totalDays: row.total_days,
      avgScore: row.avg_score,
    }));
  }

  async getGroupStreak(guildId: string): Promise<number> {
    const today = getRecifeDate();
    const yesterday = this.getYesterday(today);

    const rows = await db
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
    const today = getRecifeDate();
    const result = await this.pickNewWord(guildId, today);
    // Clear all player sessions for today so everyone can play the new word
    await db
      .delete(wordleSessions)
      .where(
        and(
          eq(wordleSessions.guild_id, guildId),
          eq(wordleSessions.word_date, today),
        ),
      );
    return result;
  }

  async setConfig(guildId: string, channelId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
      .insert(wordleConfig)
      .values({ guild_id: guildId, channel_id: channelId, updated_at: now })
      .onConflictDoUpdate({
        target: wordleConfig.guild_id,
        set: { channel_id: channelId, updated_at: now },
      });
  }

  async getConfig(guildId: string): Promise<{ channelId: string } | null> {
    const [row] = await db
      .select({ channel_id: wordleConfig.channel_id })
      .from(wordleConfig)
      .where(eq(wordleConfig.guild_id, guildId));

    return row ? { channelId: row.channel_id } : null;
  }

  async getAllConfiguredGuilds(): Promise<
    { guildId: string; channelId: string }[]
  > {
    const rows = await db
      .select({
        guild_id: wordleConfig.guild_id,
        channel_id: wordleConfig.channel_id,
      })
      .from(wordleConfig);
    return rows.map((r) => ({ guildId: r.guild_id, channelId: r.channel_id }));
  }

  private async ensureReviewSeeded(): Promise<void> {
    const [row] = await db.select({ count: count() }).from(wordlistReview);
    if (row && row.count > 0) return;

    const words = getWordlist();
    await db.transaction(async (tx) => {
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

    const [counts] = await db
      .select({
        total: count(),
        reviewed: count(wordlistReview.is_banned),
      })
      .from(wordlistReview);
    const total = counts?.total ?? 0;
    const reviewed = counts?.reviewed ?? 0;
    const [next] = await db
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

    await db
      .update(wordlistReview)
      .set({ is_banned: decision === 'remove' })
      .where(eq(wordlistReview.word, word));
    if (decision === 'remove') bannedWordsCache.add(word);
    else bannedWordsCache.delete(word);

    return this.getNextReviewWord();
  }

  async getWordlistPoolStats(): Promise<{
    total: number;
    used: number;
    remaining: number;
  }> {
    const wordlist = getWordlist();
    const total = wordlist.filter((w) => w.length >= 5 && w.length <= 6).length;
    const [row] = await db.select({ count: count() }).from(wordleUsedWords);
    const used = row?.count ?? 0;
    return { total, used, remaining: total - used };
  }
}

function sessionOf(userId: string, guildId: string, wordDate: string) {
  return and(
    eq(wordleSessions.user_id, userId),
    eq(wordleSessions.guild_id, guildId),
    eq(wordleSessions.word_date, wordDate),
  );
}
