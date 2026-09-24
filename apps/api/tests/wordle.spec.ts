import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { GuessResult } from 'services/wordle';

import { db } from '@marquinhos/database/client';
import {
  wordleDaily,
  wordleSessions,
  wordlistReview,
} from '@marquinhos/database/schema';
import { and, eq, sql } from 'drizzle-orm';

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

async function seedSession(
  guildId: string,
  userId: string,
  wordDate: string,
  attempts: number,
  solved: boolean,
  wordLength = 5,
) {
  const { randomUUID } = require('crypto');
  const session = {
    id: randomUUID(),
    user_id: userId,
    guild_id: guildId,
    word_date: wordDate,
    guesses: '[]',
    solved,
    attempts,
    word_length: wordLength,
    created_at: 0,
  };
  const { id: _id, ...update } = session;
  await db
    .insert(wordleSessions)
    .values(session)
    .onConflictDoUpdate({
      target: [
        wordleSessions.user_id,
        wordleSessions.guild_id,
        wordleSessions.word_date,
      ],
      set: update,
    });
}

describe('WordleService.pickNewWord', () => {
  let service: WordleService;
  const originalRandom = Math.random;

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM wordle_used_words`);
    await db.execute(sql`DELETE FROM wordle_daily`);
    service = new WordleService();
  });

  afterEach(async () => {
    Math.random = originalRandom;
  });

  it('picks from devaneios-wordlist.txt when Math.random() is below the 80% weight', async () => {
    Math.random = () => 0.1;
    const result = await service.pickNewWord('guild-devaneios', '2026-01-01');

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

  it('picks from wordlist.txt when Math.random() is at/above the 80% weight', async () => {
    Math.random = () => 0.9;
    const result = await service.pickNewWord('guild-wordlist', '2026-01-02');

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

  it('never picks a word marked banned in wordlist_review', async () => {
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

    await db.execute(sql`DELETE FROM wordlist_review`);
    // Leave exactly one word unbanned so a pick is still possible
    const survivor = wordlistWords[0];
    const banned = [...new Set(wordlistWords)].filter((w) => w !== survivor);
    for (let i = 0; i < banned.length; i += 5_000) {
      await db
        .insert(wordlistReview)
        .values(
          banned.slice(i, i + 5_000).map((word) => ({ word, is_banned: true })),
        );
    }
    // pickNewWord reads bans from the database; the in-memory list only feeds
    // Wordle Race.

    const result = await service.pickNewWord('guild-banned', '2026-01-03');
    expect(result.word).toBe(survivor);

    await db.execute(sql`DELETE FROM wordlist_review`);
  });
});

describe('WordleService.getGroupStreak', () => {
  let service: WordleService;

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM wordle_sessions`);
    service = new WordleService();
  });

  it('returns 0 when no days have been played', async () => {
    expect(await service.getGroupStreak('guild1')).toBe(0);
  });

  it('returns 0 when the most recent day is not yesterday', async () => {
    // Two days ago — gap before yesterday means streak is broken
    await seedSession('guild1', 'user1', daysAgo(2), 3, true);
    expect(await service.getGroupStreak('guild1')).toBe(0);
  });

  it('counts consecutive days up to yesterday', async () => {
    await seedSession('guild1', 'user1', daysAgo(1), 3, true);
    await seedSession('guild1', 'user2', daysAgo(2), 2, true);
    await seedSession('guild1', 'user1', daysAgo(3), 4, true);

    expect(await service.getGroupStreak('guild1')).toBe(3);
  });

  it('stops counting at a gap', async () => {
    await seedSession('guild1', 'user1', daysAgo(1), 3, true);
    await seedSession('guild1', 'user1', daysAgo(3), 4, true);

    expect(await service.getGroupStreak('guild1')).toBe(1);
  });

  it('ignores todays session when computing the streak', async () => {
    await seedSession('guild1', 'user1', daysAgo(0), 1, true);
    await seedSession('guild1', 'user1', daysAgo(1), 3, true);
    await seedSession('guild1', 'user1', daysAgo(2), 2, true);

    expect(await service.getGroupStreak('guild1')).toBe(2);
  });
});

describe('WordleService.getLeaderboard with period', () => {
  let service: WordleService;

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM wordle_sessions`);
    service = new WordleService();
  });

  it('daily: returns only todays sessions sorted by solved DESC, attempts ASC', async () => {
    const today = getRecifeDate();

    await seedSession('g1', 'user1', today, 3, true);
    await seedSession('g1', 'user2', today, 2, true);
    await seedSession('g1', 'user3', today, 6, false);
    await seedSession('g1', 'user4', '2020-01-01', 1, true);

    const entries = (await service.getLeaderboard('g1', 10, 'daily')) as {
      userId: string;
      attempts: number;
      solved: boolean;
    }[];

    expect(entries).toHaveLength(3);
    expect(entries[0].userId).toBe('user2');
    expect(entries[1].userId).toBe('user1');
    expect(entries[2].userId).toBe('user3');
  });

  it('daily: returns the given day when a date is passed', async () => {
    await seedSession('g1', 'user1', getRecifeDate(), 3, true);
    await seedSession('g1', 'user2', daysAgo(1), 2, true);

    const entries = (await service.getLeaderboard(
      'g1',
      10,
      'daily',
      daysAgo(1),
    )) as {
      userId: string;
    }[];

    expect(entries.map((e) => e.userId)).toEqual(['user2']);
  });

  it('all-time: default behavior unchanged', async () => {
    await seedSession('g1', 'user1', '2026-01-01', 3, true);
    await seedSession('g1', 'user1', '2026-01-02', 2, true);
    await seedSession('g1', 'user2', '2026-01-01', 1, true);

    const entries = (await service.getLeaderboard('g1', 10, 'all-time')) as {
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

  async function setDaily(word: string) {
    const daily = {
      word,
      word_date: getRecifeDate(),
      players_count: 0,
      winners_count: 0,
      total_attempts: 0,
      created_at: 0,
    };
    await db
      .insert(wordleDaily)
      .values({ guild_id: guildId, ...daily })
      .onConflictDoUpdate({ target: wordleDaily.guild_id, set: daily });
  }

  async function dailyCounts() {
    const [row] = await db
      .select({
        players_count: wordleDaily.players_count,
        winners_count: wordleDaily.winners_count,
      })
      .from(wordleDaily)
      .where(eq(wordleDaily.guild_id, guildId));
    return row!;
  }

  async function sessionOf(userId: string) {
    const [row] = await db
      .select({ solved: wordleSessions.solved })
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.user_id, userId),
          eq(wordleSessions.guild_id, guildId),
        ),
      );
    return row ?? null;
  }

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM wordle_sessions`);
    await db.execute(sql`DELETE FROM wordle_daily`);
    await db.execute(sql`DELETE FROM wordle_streaks`);
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

    await setDaily(dailyWord);
  });

  it('rolls back the session insert and daily stats if a later write in the sequence throws', async () => {
    const userId = 'user-atomic-rollback';
    service.updateStreak = async () => {
      throw new Error('boom');
    };

    await expect(
      service.submitGuess(userId, guildId, dailyWord),
    ).rejects.toThrow('boom');

    const session = await sessionOf(userId);
    const daily = await dailyCounts();

    expect(session).toBeNull();
    expect(daily.players_count).toBe(0);
    expect(daily.winners_count).toBe(0);
  });

  it('atomically updates session, daily stats, and streak on a solved guess', async () => {
    const userId = 'user-atomic-happy';

    const result = await service.submitGuess(userId, guildId, dailyWord);

    expect('error' in result).toBe(false);
    expect((result as GuessResult).solved).toBe(true);
    expect((result as GuessResult).streak).toBe(1);

    const session = (await sessionOf(userId))!;
    const daily = await dailyCounts();
    const [streak] = await db.execute<{ current_streak: number }>(
      sql`SELECT current_streak FROM wordle_streaks WHERE user_id = ${userId} AND guild_id = ${guildId}`,
    );

    expect(session.solved).toBe(true);
    expect(daily.winners_count).toBe(1);
    expect(streak!.current_streak).toBe(1);
  });

  it('makes no writes when guessing again on an already-solved session', async () => {
    const userId = 'user-already-solved';
    await seedSession(guildId, userId, getRecifeDate(), 1, true);

    const before = await dailyCounts();

    const result = await service.submitGuess(userId, guildId, dailyWord);

    expect(result).toEqual({ error: 'Você já acertou a palavra de hoje!' });

    const after = await dailyCounts();
    expect(after).toEqual(before);
  });

  it('applies concurrent first guesses from the same player one after the other', async () => {
    const userId = 'user-concurrent';
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const [first, second] = (
      readFileSync(join(__dirname, '../wordlist.txt'), 'utf-8') as string
    )
      .split('\n')
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length === dailyWord.length && w !== dailyWord);

    const players = Array.from({ length: 20 }, (_, i) => `${userId}-${i}`);
    const results = await Promise.allSettled(
      players.flatMap((player) => [
        service.submitGuess(player, guildId, first!),
        service.submitGuess(player, guildId, second!),
      ]),
    );

    const failures = results.filter(
      (result) =>
        result.status === 'rejected' || 'error' in (result.value as object),
    );
    expect(failures).toEqual([]);
    expect((await dailyCounts()).players_count).toBe(players.length);
  });

  it('accepts a devaneios-only daily word (e.g. "boltar") as a correct guess', async () => {
    const userId = 'user-devaneios-word';
    const devaneiosWord = 'boltar';

    await setDaily(devaneiosWord);

    const result = await service.submitGuess(userId, guildId, devaneiosWord);

    expect('error' in result).toBe(false);
    expect((result as GuessResult).solved).toBe(true);
  });
});
