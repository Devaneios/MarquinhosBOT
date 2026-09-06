import { randomUUID } from 'crypto';
import { db } from 'database/sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';

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

interface WordleSession {
  id: string;
  user_id: string;
  guild_id: string;
  word_date: string;
  guesses: { guess: string; feedback: LetterFeedback[] }[];
  solved: boolean;
  attempts: number;
  created_at: number;
}

export type LetterFeedback = 'correct' | 'present' | 'absent';

export interface GuessResult {
  guess: string;
  feedback: LetterFeedback[];
  guesses: { guess: string; feedback: LetterFeedback[] }[];
  solved: boolean;
  attempts: number;
  wordLength: number;
  streak?: number;
}

export interface DailyStats {
  wordDate: string;
  wordLength: number;
  playersCount: number;
  winnersCount: number;
  avgAttempts: number;
}

export interface ForceNewWordResult {
  word: string;
  wordDate: string;
  wordLength: number;
}

export interface DayGuesses {
  word: string;
  wordDate: string;
  wordLength: number;
  guesses: { guess: string; feedback: LetterFeedback[] }[];
}

export interface ReviewWordResult {
  word: string | null;
  index: number;
  total: number;
  done: boolean;
}

interface WordleSessionGuessesRow {
  guesses: string;
}

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

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function normalizeGuess(s: string): string {
  return stripDiacritics(s.trim().toLowerCase());
}

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

export function buildUniqueDayGuesses(
  answerWord: string,
  rows: WordleSessionGuessesRow[],
): { guess: string; feedback: LetterFeedback[] }[] {
  const answerKey = normalizeGuess(answerWord);
  const wordLength = answerWord.length;
  const seen = new Set<string>();
  const result: { guess: string; feedback: LetterFeedback[] }[] = [];

  for (const row of rows) {
    let guesses: unknown;
    try {
      guesses = JSON.parse(row.guesses);
    } catch {
      continue;
    }

    if (!Array.isArray(guesses)) continue;

    for (const guess of guesses) {
      if (
        typeof guess !== 'object' ||
        guess === null ||
        !('guess' in guess) ||
        !('feedback' in guess) ||
        typeof guess.guess !== 'string' ||
        !Array.isArray(guess.feedback) ||
        guess.feedback.length !== wordLength
      ) {
        continue;
      }

      const key = normalizeGuess(guess.guess);
      if (!key || key === answerKey || seen.has(key)) continue;

      seen.add(key);
      result.push({
        guess: guess.guess,
        feedback: guess.feedback as LetterFeedback[],
      });
    }
  }

  return result;
}

function getRecifeDate(): string {
  // Use Intl to get the correct date in Recife timezone
  const tz = process.env.WORDLE_TIMEZONE ?? 'America/Recife';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
  // 'sv-SE' locale gives YYYY-MM-DD format
}

export function computeFeedback(guess: string, word: string): LetterFeedback[] {
  const result: LetterFeedback[] = new Array(guess.length).fill('absent');
  const wordChars = word.split('');
  const guessChars = guess.split('');

  // First pass: exact matches
  for (let i = 0; i < guessChars.length; i++) {
    if (guessChars[i] === wordChars[i]) {
      result[i] = 'correct';
      wordChars[i] = '\0'; // consume
      guessChars[i] = '\0';
    }
  }

  // Second pass: present (wrong position)
  for (let i = 0; i < guessChars.length; i++) {
    const gc = guessChars[i];
    if (gc === undefined || gc === '\0') continue;
    const idx = wordChars.indexOf(gc);
    if (idx !== -1) {
      result[i] = 'present';
      wordChars[idx] = '\0'; // consume to handle duplicates
    }
  }

  return result;
}

export class WordleService {
  pickNewWord(guildId: string, wordDate: string): ForceNewWordResult {
    // Load used words into a Set for O(1) lookup
    const usedRows = db
      .query<{ word: string }, []>('SELECT word FROM wordle_used_words')
      .all();
    const usedSet = new Set(usedRows.map((r: { word: string }) => r.word));

    const bannedRows = db
      .query<{ word: string }, []>(
        'SELECT word FROM wordlist_review WHERE is_banned = 1',
      )
      .all();
    const bannedSet = new Set(bannedRows.map((r: { word: string }) => r.word));

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

    // Save to used words
    db.query(
      'INSERT OR REPLACE INTO wordle_used_words (word, used_at) VALUES ($word, $used_at)',
    ).run({ $word: word, $used_at: now });

    // Upsert daily game (overwrite if forcing new word)
    db.query(
      `INSERT OR REPLACE INTO wordle_daily
        (guild_id, word, word_date, players_count, winners_count, total_attempts, created_at)
       VALUES ($guild_id, $word, $word_date, 0, 0, 0, $now)`,
    ).run({ $guild_id: guildId, $word: word, $word_date: wordDate, $now: now });

    return { word, wordDate, wordLength: word.length };
  }

  getDailyWord(guildId: string): WordleDaily {
    const today = getRecifeDate();
    const row = db
      .query<WordleDaily, { $guild_id: string }>(
        'SELECT * FROM wordle_daily WHERE guild_id = $guild_id',
      )
      .get({ $guild_id: guildId });

    if (!row || row.word_date !== today) {
      // Lazy init: pick a new word for today
      this.pickNewWord(guildId, today);
      return db
        .query<WordleDaily, { $guild_id: string }>(
          'SELECT * FROM wordle_daily WHERE guild_id = $guild_id',
        )
        .get({ $guild_id: guildId })!;
    }

    return row;
  }

  submitGuess(
    userId: string,
    guildId: string,
    guess: string,
  ): GuessResult | { error: string } {
    const canonicalGuess = resolveCanonical(guess);
    if (!canonicalGuess) {
      return { error: 'Palavra não encontrada na lista de palavras válidas.' };
    }

    const daily = this.getDailyWord(guildId);

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

    // Get existing session, if any
    const sessionRow = db
      .query<
        { id: string; guesses: string; solved: number; attempts: number },
        { $user_id: string; $guild_id: string; $word_date: string }
      >(
        'SELECT id, guesses, solved, attempts FROM wordle_sessions WHERE user_id = $user_id AND guild_id = $guild_id AND word_date = $word_date',
      )
      .get({ $user_id: userId, $guild_id: guildId, $word_date: today });

    if (sessionRow?.solved) {
      return { error: 'Você já acertou a palavra de hoje!' };
    }

    const previousGuesses: { guess: string; feedback: LetterFeedback[] }[] =
      sessionRow ? JSON.parse(sessionRow.guesses) : [];

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
    const newAttempts = (sessionRow?.attempts ?? 0) + 1;

    const fn = db.transaction(() => {
      const sessionId = sessionRow?.id ?? randomUUID();

      if (!sessionRow) {
        db.query(
          `INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, guesses, solved, attempts, word_length, created_at)
           VALUES ($id, $user_id, $guild_id, $word_date, '[]', 0, 0, $word_length, $now)`,
        ).run({
          $id: sessionId,
          $user_id: userId,
          $guild_id: guildId,
          $word_date: today,
          $word_length: daily.word.length,
          $now: now,
        });
      }

      // Update session
      db.query(
        `UPDATE wordle_sessions SET guesses = $guesses, solved = $solved, attempts = $attempts
         WHERE id = $id`,
      ).run({
        $guesses: JSON.stringify(newGuesses),
        $solved: solved ? 1 : 0,
        $attempts: newAttempts,
        $id: sessionId,
      });

      // Update daily stats.
      // players_count is incremented exactly once per user per day: on their first guess,
      // regardless of whether that guess solves the puzzle. The previous CASE WHEN expression
      // caused a bug where a user who solved on a later guess never incremented players_count
      // (previousGuesses.length > 0 → $is_new_player = 0).
      if (previousGuesses.length === 0) {
        // First guess of the day for this user
        if (solved) {
          db.query(
            `UPDATE wordle_daily SET
              players_count = players_count + 1,
              winners_count = winners_count + 1,
              total_attempts = total_attempts + $attempts
             WHERE guild_id = $guild_id`,
          ).run({
            $attempts: newAttempts,
            $guild_id: guildId,
          });
        } else {
          db.query(
            'UPDATE wordle_daily SET players_count = players_count + 1 WHERE guild_id = $guild_id',
          ).run({ $guild_id: guildId });
        }
      } else if (solved) {
        // Returning player (already counted) who now solved
        db.query(
          `UPDATE wordle_daily SET
            winners_count = winners_count + 1,
            total_attempts = total_attempts + $attempts
           WHERE guild_id = $guild_id`,
        ).run({
          $attempts: newAttempts,
          $guild_id: guildId,
        });
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
        result.streak = this.updateStreak(userId, guildId);
      }

      return result;
    });

    return fn();
  }

  getUserSession(userId: string, guildId: string): WordleSession | null {
    const today = getRecifeDate();
    const row = db
      .query<
        {
          id: string;
          guesses: string;
          solved: number;
          attempts: number;
          created_at: number;
        },
        { $user_id: string; $guild_id: string; $word_date: string }
      >(
        'SELECT id, guesses, solved, attempts, created_at FROM wordle_sessions WHERE user_id = $user_id AND guild_id = $guild_id AND word_date = $word_date',
      )
      .get({ $user_id: userId, $guild_id: guildId, $word_date: today });

    if (!row) return null;

    return {
      id: row.id,
      user_id: userId,
      guild_id: guildId,
      word_date: today,
      guesses: JSON.parse(row.guesses),
      solved: row.solved === 1,
      attempts: row.attempts,
      created_at: row.created_at,
    };
  }

  validateGuess(
    guildId: string,
    guess: string,
  ): { valid: boolean; wordLength: number; message: string } {
    const normalized = guess.trim().toLowerCase();
    const daily = this.getDailyWord(guildId);

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

  getDailyStats(guildId: string): DailyStats {
    const daily = this.getDailyWord(guildId);
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

  getDayGuesses(guildId: string): DayGuesses | null {
    const daily = db
      .query<WordleDaily, { $guild_id: string }>(
        'SELECT * FROM wordle_daily WHERE guild_id = $guild_id',
      )
      .get({ $guild_id: guildId });

    if (!daily) return null;

    const rows = db
      .query<
        WordleSessionGuessesRow,
        { $guild_id: string; $word_date: string }
      >(
        `SELECT guesses
         FROM wordle_sessions
         WHERE guild_id = $guild_id AND word_date = $word_date
         ORDER BY created_at ASC`,
      )
      .all({ $guild_id: guildId, $word_date: daily.word_date });

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

  private computeStreakFromHistory(
    userId: string,
    guildId: string,
    today: string,
  ): number {
    const rows = db
      .query<{ word_date: string }, { $user_id: string; $guild_id: string }>(
        `SELECT word_date FROM wordle_sessions
         WHERE user_id = $user_id AND guild_id = $guild_id AND solved = 1
         ORDER BY word_date DESC`,
      )
      .all({ $user_id: userId, $guild_id: guildId });

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

  updateStreak(userId: string, guildId: string): number {
    const today = getRecifeDate();

    const row = db
      .query<
        {
          current_streak: number;
          max_streak: number;
          last_solved_date: string | null;
        },
        { $user_id: string; $guild_id: string }
      >(
        `SELECT current_streak, max_streak, last_solved_date FROM wordle_streaks
         WHERE user_id = $user_id AND guild_id = $guild_id`,
      )
      .get({ $user_id: userId, $guild_id: guildId });

    if (!row) {
      const streak = this.computeStreakFromHistory(userId, guildId, today);
      db.query(
        `INSERT INTO wordle_streaks (user_id, guild_id, current_streak, max_streak, last_solved_date)
         VALUES ($user_id, $guild_id, $streak, $streak, $today)`,
      ).run({
        $user_id: userId,
        $guild_id: guildId,
        $streak: streak,
        $today: today,
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

    db.query(
      `UPDATE wordle_streaks SET current_streak = $streak, max_streak = $max, last_solved_date = $today
       WHERE user_id = $user_id AND guild_id = $guild_id`,
    ).run({
      $user_id: userId,
      $guild_id: guildId,
      $streak: newStreak,
      $max: newMax,
      $today: today,
    });

    return newStreak;
  }

  getStreak(
    userId: string,
    guildId: string,
  ): { currentStreak: number; maxStreak: number } {
    const row = db
      .query<
        {
          current_streak: number;
          max_streak: number;
          last_solved_date: string | null;
        },
        { $user_id: string; $guild_id: string }
      >(
        `SELECT current_streak, max_streak, last_solved_date FROM wordle_streaks
         WHERE user_id = $user_id AND guild_id = $guild_id`,
      )
      .get({ $user_id: userId, $guild_id: guildId });

    if (!row) {
      const today = getRecifeDate();
      const streak = this.computeStreakFromHistory(userId, guildId, today);
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

  getLeaderboard(
    guildId: string,
    limit = 10,
    period: 'all-time' | 'weekly' | 'monthly' | 'daily' = 'all-time',
  ):
    | { userId: string; totalDays: number; avgScore: number }[]
    | { userId: string; attempts: number; solved: boolean }[] {
    if (period === 'daily') {
      const today = getRecifeDate();
      return db
        .query<
          { user_id: string; attempts: number; solved: number },
          { $guild_id: string; $today: string; $limit: number }
        >(
          `SELECT user_id, attempts, solved
           FROM wordle_sessions
           WHERE guild_id = $guild_id AND word_date = $today
           ORDER BY solved DESC, attempts ASC
           LIMIT $limit`,
        )
        .all({ $guild_id: guildId, $today: today, $limit: limit })
        .map((row: { user_id: string; attempts: number; solved: number }) => ({
          userId: row.user_id,
          attempts: row.attempts,
          solved: row.solved === 1,
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

    const dateFilter = dateFrom ? 'AND word_date >= $date_from' : '';

    return db
      .query<
        { user_id: string; total_days: number; avg_score: number },
        { $guild_id: string; $limit: number; $date_from?: string }
      >(
        `SELECT
           p.user_id,
           COUNT(d.word_date) AS total_days,
           ROUND(
             CAST(SUM(COALESCE(s.attempts, d.word_length + 1)) AS REAL) / COUNT(d.word_date),
             2
           ) AS avg_score
         FROM (
           SELECT DISTINCT user_id FROM wordle_sessions
           WHERE guild_id = $guild_id ${dateFilter}
         ) p
         CROSS JOIN (
           SELECT DISTINCT word_date, word_length
           FROM wordle_sessions
           WHERE guild_id = $guild_id AND word_length > 0 ${dateFilter}
         ) d
         LEFT JOIN wordle_sessions s
           ON s.user_id = p.user_id
           AND s.guild_id = $guild_id
           AND s.word_date = d.word_date
         GROUP BY p.user_id
         ORDER BY avg_score ASC
         LIMIT $limit`,
      )
      .all(
        dateFrom
          ? { $guild_id: guildId, $limit: limit, $date_from: dateFrom }
          : { $guild_id: guildId, $limit: limit },
      )
      .map(
        (row: { user_id: string; total_days: number; avg_score: number }) => ({
          userId: row.user_id,
          totalDays: row.total_days,
          avgScore: row.avg_score,
        }),
      );
  }

  getGroupStreak(guildId: string): number {
    const today = getRecifeDate();
    const yesterday = this.getYesterday(today);

    const rows = db
      .query<{ word_date: string }, { $guild_id: string }>(
        `SELECT DISTINCT word_date FROM wordle_sessions
         WHERE guild_id = $guild_id
         ORDER BY word_date DESC`,
      )
      .all({ $guild_id: guildId });

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

  forceNewWord(guildId: string): ForceNewWordResult {
    const today = getRecifeDate();
    const result = this.pickNewWord(guildId, today);
    // Clear all player sessions for today so everyone can play the new word
    db.query(
      'DELETE FROM wordle_sessions WHERE guild_id = $guild_id AND word_date = $word_date',
    ).run({ $guild_id: guildId, $word_date: today });
    return result;
  }

  setConfig(guildId: string, channelId: string): void {
    const now = Math.floor(Date.now() / 1000);
    db.query(
      `INSERT OR REPLACE INTO wordle_config (guild_id, channel_id, updated_at)
       VALUES ($guild_id, $channel_id, $now)`,
    ).run({ $guild_id: guildId, $channel_id: channelId, $now: now });
  }

  getConfig(guildId: string): { channelId: string } | null {
    const row = db
      .query<{ channel_id: string }, { $guild_id: string }>(
        'SELECT channel_id FROM wordle_config WHERE guild_id = $guild_id',
      )
      .get({ $guild_id: guildId });

    return row ? { channelId: row.channel_id } : null;
  }

  getAllConfiguredGuilds(): { guildId: string; channelId: string }[] {
    return db
      .query<{ guild_id: string; channel_id: string }, []>(
        'SELECT guild_id, channel_id FROM wordle_config',
      )
      .all()
      .map((r: { guild_id: string; channel_id: string }) => ({
        guildId: r.guild_id,
        channelId: r.channel_id,
      }));
  }

  private ensureReviewSeeded(): void {
    const { count } = db
      .query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM wordlist_review',
      )
      .get()!;
    if (count > 0) return;

    const insert = db.prepare(
      'INSERT OR IGNORE INTO wordlist_review (word, is_banned) VALUES ($word, NULL)',
    );
    const insertAll = db.transaction((words: string[]) => {
      for (const w of words) insert.run({ $word: w });
    });
    insertAll(getWordlist());
  }

  getNextReviewWord(): ReviewWordResult {
    this.ensureReviewSeeded();

    const total = db
      .query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM wordlist_review',
      )
      .get()!.count;
    const reviewed = db
      .query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM wordlist_review WHERE is_banned IS NOT NULL',
      )
      .get()!.count;
    const next = db
      .query<{ word: string }, []>(
        'SELECT word FROM wordlist_review WHERE is_banned IS NULL ORDER BY rowid LIMIT 1',
      )
      .get();

    if (!next) {
      return { word: null, index: total, total, done: true };
    }

    return { word: next.word, index: reviewed, total, done: false };
  }

  submitReviewDecision(
    word: string,
    decision: 'keep' | 'remove',
  ): ReviewWordResult {
    this.ensureReviewSeeded();

    db.query(
      'UPDATE wordlist_review SET is_banned = $is_banned WHERE word = $word',
    ).run({ $is_banned: decision === 'remove' ? 1 : 0, $word: word });

    return this.getNextReviewWord();
  }

  getWordlistPoolStats(): { total: number; used: number; remaining: number } {
    const wordlist = getWordlist();
    const total = wordlist.filter((w) => w.length >= 5 && w.length <= 6).length;
    const used =
      db
        .query<{ count: number }, []>(
          'SELECT COUNT(*) as count FROM wordle_used_words',
        )
        .get()?.count ?? 0;
    return { total, used, remaining: total - used };
  }
}
