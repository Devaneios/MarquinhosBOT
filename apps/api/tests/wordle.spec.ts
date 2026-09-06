import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { GuessResult } from 'services/wordle';

// Set in-memory db BEFORE any imports that load the db module
process.env.SQLITE_PATH = ':memory:';

const { db } = await import('../src/database/sqlite');
const { WordleService } = await import('../src/services/wordle');

function getRecifeDate(): string {
  const tz = process.env.WORDLE_TIMEZONE ?? 'America/Recife';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
}

function daysAgo(n: number): string {
  const d = new Date(`${getRecifeDate()}T12:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function seedSession(
  guildId: string,
  userId: string,
  wordDate: string,
  attempts: number,
  solved: boolean,
  wordLength = 5,
) {
  const { randomUUID } = require('crypto');
  db.run(
    `INSERT OR REPLACE INTO wordle_sessions
       (id, user_id, guild_id, word_date, guesses, solved, attempts, word_length, created_at)
     VALUES (?, ?, ?, ?, '[]', ?, ?, ?, 0)`,
    [
      randomUUID(),
      userId,
      guildId,
      wordDate,
      solved ? 1 : 0,
      attempts,
      wordLength,
    ],
  );
}

describe('WordleService.pickNewWord', () => {
  let service: WordleService;
  const originalRandom = Math.random;

  beforeEach(() => {
    db.run('DELETE FROM wordle_used_words');
    db.run('DELETE FROM wordle_daily');
    service = new WordleService();
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('picks from devaneios-wordlist.txt when Math.random() is below the 80% weight', () => {
    Math.random = () => 0.1;
    const result = service.pickNewWord('guild-devaneios', '2026-01-01');

    const { readFileSync } = require('fs');
    const { join } = require('path');
    const devaneiosWords = new Set(
      readFileSync(join(__dirname, '../devaneios-wordlist.txt'), 'utf-8')
        .split('\n')
        .map((w: string) => w.trim().toLowerCase())
        .filter((w: string) => w.length > 0),
    );

    expect(devaneiosWords.has(result.word)).toBe(true);
  });

  it('picks from wordlist.txt when Math.random() is at/above the 80% weight', () => {
    Math.random = () => 0.9;
    const result = service.pickNewWord('guild-wordlist', '2026-01-02');

    const { readFileSync } = require('fs');
    const { join } = require('path');
    const wordlistWords = new Set(
      readFileSync(join(__dirname, '../wordlist.txt'), 'utf-8')
        .split('\n')
        .map((w: string) => w.trim().toLowerCase())
        .filter((w: string) => w.length > 0),
    );

    expect(wordlistWords.has(result.word)).toBe(true);
  });

  it('never picks a word marked banned in wordlist_review', () => {
    Math.random = () => 0.9;

    const { readFileSync } = require('fs');
    const { join } = require('path');
    const wordlistWords: string[] = readFileSync(
      join(__dirname, '../wordlist.txt'),
      'utf-8',
    )
      .split('\n')
      .map((w: string) => w.trim().toLowerCase())
      .filter((w: string) => w.length >= 5 && w.length <= 6);

    db.run('DELETE FROM wordlist_review');
    // Leave exactly one word unbanned so a pick is still possible
    const survivor = wordlistWords[0];
    const insertBanned = db.prepare(
      'INSERT INTO wordlist_review (word, is_banned) VALUES ($word, 1)',
    );
    const insertAll = db.transaction((words: string[]) => {
      for (const w of words) {
        if (w !== survivor) insertBanned.run({ $word: w });
      }
    });
    insertAll(wordlistWords);

    const result = service.pickNewWord('guild-banned', '2026-01-03');
    expect(result.word).toBe(survivor);

    db.run('DELETE FROM wordlist_review');
  });
});

describe('WordleService.getGroupStreak', () => {
  let service: WordleService;

  beforeEach(() => {
    db.run('DELETE FROM wordle_sessions');
    service = new WordleService();
  });

  it('returns 0 when no days have been played', () => {
    expect(service.getGroupStreak('guild1')).toBe(0);
  });

  it('returns 0 when the most recent day is not yesterday', () => {
    // Two days ago — gap before yesterday means streak is broken
    seedSession('guild1', 'user1', daysAgo(2), 3, true);
    expect(service.getGroupStreak('guild1')).toBe(0);
  });

  it('counts consecutive days up to yesterday', () => {
    seedSession('guild1', 'user1', daysAgo(1), 3, true);
    seedSession('guild1', 'user2', daysAgo(2), 2, true);
    seedSession('guild1', 'user1', daysAgo(3), 4, true);

    expect(service.getGroupStreak('guild1')).toBe(3);
  });

  it('stops counting at a gap', () => {
    seedSession('guild1', 'user1', daysAgo(1), 3, true);
    seedSession('guild1', 'user1', daysAgo(3), 4, true);

    expect(service.getGroupStreak('guild1')).toBe(1);
  });

  it('ignores todays session when computing the streak', () => {
    seedSession('guild1', 'user1', daysAgo(0), 1, true);
    seedSession('guild1', 'user1', daysAgo(1), 3, true);
    seedSession('guild1', 'user1', daysAgo(2), 2, true);

    expect(service.getGroupStreak('guild1')).toBe(2);
  });
});

describe('WordleService.getLeaderboard with period', () => {
  let service: WordleService;

  beforeEach(() => {
    db.run('DELETE FROM wordle_sessions');
    service = new WordleService();
  });

  it('daily: returns only todays sessions sorted by solved DESC, attempts ASC', () => {
    const today = getRecifeDate();

    seedSession('g1', 'user1', today, 3, true);
    seedSession('g1', 'user2', today, 2, true);
    seedSession('g1', 'user3', today, 6, false);
    seedSession('g1', 'user4', '2020-01-01', 1, true);

    const entries = service.getLeaderboard('g1', 10, 'daily') as {
      userId: string;
      attempts: number;
      solved: boolean;
    }[];

    expect(entries).toHaveLength(3);
    expect(entries[0].userId).toBe('user2');
    expect(entries[1].userId).toBe('user1');
    expect(entries[2].userId).toBe('user3');
  });

  it('all-time: default behavior unchanged', () => {
    seedSession('g1', 'user1', '2026-01-01', 3, true);
    seedSession('g1', 'user1', '2026-01-02', 2, true);
    seedSession('g1', 'user2', '2026-01-01', 1, true);

    const entries = service.getLeaderboard('g1', 10, 'all-time') as {
      userId: string;
      avgScore: number;
    }[];

    expect(entries.length).toBeGreaterThan(0);
    // user1 played both days (avg 2.5); user2 played only day 1 and gets penalised
    // for day 2 (avg (1+6)/2 = 3.5) — so user1 ranks first
    expect(entries[0].userId).toBe('user1');
  });
});

describe('WordleService.submitGuess', () => {
  let service: WordleService;
  const guildId = 'guild-atomic';
  let dailyWord: string;

  beforeEach(() => {
    db.run('DELETE FROM wordle_sessions');
    db.run('DELETE FROM wordle_daily');
    db.run('DELETE FROM wordle_streaks');
    service = new WordleService();

    const { readFileSync } = require('fs');
    const { join } = require('path');
    const wordlistWords: string[] = readFileSync(
      join(__dirname, '../wordlist.txt'),
      'utf-8',
    )
      .split('\n')
      .map((w: string) => w.trim().toLowerCase())
      .filter((w: string) => w.length > 0);
    dailyWord = wordlistWords[0];

    db.run(
      `INSERT OR REPLACE INTO wordle_daily
         (guild_id, word, word_date, players_count, winners_count, total_attempts, created_at)
       VALUES ($guild_id, $word, $word_date, 0, 0, 0, 0)`,
      { $guild_id: guildId, $word: dailyWord, $word_date: getRecifeDate() },
    );
  });

  it('rolls back the session insert and daily stats if a later write in the sequence throws', () => {
    const userId = 'user-atomic-rollback';
    service.updateStreak = () => {
      throw new Error('boom');
    };

    expect(() => service.submitGuess(userId, guildId, dailyWord)).toThrow(
      'boom',
    );

    const session = db
      .query(
        'SELECT solved FROM wordle_sessions WHERE user_id = $user_id AND guild_id = $guild_id',
      )
      .get({ $user_id: userId, $guild_id: guildId });
    const daily = db
      .query(
        'SELECT players_count, winners_count FROM wordle_daily WHERE guild_id = $guild_id',
      )
      .get({ $guild_id: guildId }) as {
      players_count: number;
      winners_count: number;
    };

    expect(session).toBeNull();
    expect(daily.players_count).toBe(0);
    expect(daily.winners_count).toBe(0);
  });

  it('atomically updates session, daily stats, and streak on a solved guess', () => {
    const userId = 'user-atomic-happy';

    const result = service.submitGuess(userId, guildId, dailyWord);

    expect('error' in result).toBe(false);
    expect((result as GuessResult).solved).toBe(true);
    expect((result as GuessResult).streak).toBe(1);

    const session = db
      .query(
        'SELECT solved FROM wordle_sessions WHERE user_id = $user_id AND guild_id = $guild_id',
      )
      .get({ $user_id: userId, $guild_id: guildId }) as { solved: number };
    const daily = db
      .query(
        'SELECT winners_count FROM wordle_daily WHERE guild_id = $guild_id',
      )
      .get({ $guild_id: guildId }) as { winners_count: number };
    const streak = db
      .query(
        'SELECT current_streak FROM wordle_streaks WHERE user_id = $user_id AND guild_id = $guild_id',
      )
      .get({ $user_id: userId, $guild_id: guildId }) as {
      current_streak: number;
    };

    expect(session.solved).toBe(1);
    expect(daily.winners_count).toBe(1);
    expect(streak.current_streak).toBe(1);
  });

  it('makes no writes when guessing again on an already-solved session', () => {
    const userId = 'user-already-solved';
    seedSession(guildId, userId, getRecifeDate(), 1, true);

    const before = db
      .query(
        'SELECT players_count, winners_count FROM wordle_daily WHERE guild_id = $guild_id',
      )
      .get({ $guild_id: guildId });

    const result = service.submitGuess(userId, guildId, dailyWord);

    expect(result).toEqual({ error: 'Você já acertou a palavra de hoje!' });

    const after = db
      .query(
        'SELECT players_count, winners_count FROM wordle_daily WHERE guild_id = $guild_id',
      )
      .get({ $guild_id: guildId });
    expect(after).toEqual(before);
  });

  it('accepts a devaneios-only daily word (e.g. "boltar") as a correct guess', () => {
    const userId = 'user-devaneios-word';
    const devaneiosWord = 'boltar';

    db.run(
      `INSERT OR REPLACE INTO wordle_daily
         (guild_id, word, word_date, players_count, winners_count, total_attempts, created_at)
       VALUES ($guild_id, $word, $word_date, 0, 0, 0, 0)`,
      { $guild_id: guildId, $word: devaneiosWord, $word_date: getRecifeDate() },
    );

    const result = service.submitGuess(userId, guildId, devaneiosWord);

    expect('error' in result).toBe(false);
    expect((result as GuessResult).solved).toBe(true);
  });
});
