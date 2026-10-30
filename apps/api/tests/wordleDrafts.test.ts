import { db } from '@marquinhos/database/client';
import {
  userAchievements,
  wordleDays,
  wordleDrafts,
  wordleSessions,
} from '@marquinhos/database/schema';
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { WordleService, resolveCanonical } from 'services/wordle';
import { WordleAchievementService } from 'services/wordle/WordleAchievementService';
import { WordleDraftService } from 'services/wordle/WordleDraftService';
import {
  getRecifeDate,
  getWordleDayEndEpoch,
} from 'services/wordle/wordleDate';
import {
  achievementXp,
  identity,
  installWordleAchievementCatalog,
} from './helpers/wordleAchievementCatalog';

const currentDate = getRecifeDate();
const currentNow = Date.parse(`${currentDate}T15:00:00Z`);
const shiftDate = (date: string, offset: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};
const previousDate = shiftDate(currentDate, -1);
const olderDate = shiftDate(currentDate, -2);

let restoreCatalog: (() => Promise<void>) | undefined;
beforeAll(async () => {
  restoreCatalog = await installWordleAchievementCatalog();
});
afterAll(async () => {
  await restoreCatalog?.();
});

async function seedDay(guildId: string, date: string, word: string) {
  await db
    .insert(wordleDays)
    .values({
      guild_id: guildId,
      word_date: date,
      word,
      word_length: word.length,
      is_legacy: false,
      created_at: Math.floor(currentNow / 1000),
    })
    .onConflictDoUpdate({
      target: [wordleDays.guild_id, wordleDays.word_date],
      set: { word, word_length: word.length, is_legacy: false },
    });
}

function draftWrite(
  date: string,
  answer: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    date,
    rowIndex: 0,
    cells: [...answer],
    activeIndex: Math.max(answer.length - 1, 0),
    expectedRevision: 0,
    ...overrides,
  };
}

async function sessionFor(userId: string, guildId: string, date: string) {
  const [row] = await db
    .select()
    .from(wordleSessions)
    .where(
      and(
        eq(wordleSessions.user_id, userId),
        eq(wordleSessions.guild_id, guildId),
        eq(wordleSessions.word_date, date),
      ),
    );
  return row;
}

describe('Wordle saved draft finalization', () => {
  it('clears same-day drafts when an administrator replaces the answer', async () => {
    const { userId, guildId } = identity();
    await seedDay(guildId, currentDate, 'termo');
    const drafts = new WordleDraftService(() => currentNow);
    await drafts.write(userId, guildId, draftWrite(currentDate, 'termo'));

    await new WordleService().forceNewWord(guildId);

    expect(
      await drafts.getCurrentDraft(userId, guildId, currentDate),
    ).toBeNull();
    expect(await sessionFor(userId, guildId, currentDate)).toBeUndefined();
  });

  it('closes a draft write when the date advances after it acquires the day lock', async () => {
    const { userId, guildId } = identity();
    await seedDay(guildId, currentDate, 'termo');
    const nextDate = shiftDate(currentDate, 1);
    const nextDateNow = Date.parse(`${nextDate}T15:00:00Z`);
    let clockReads = 0;
    const drafts = new WordleDraftService(() => {
      clockReads += 1;
      return clockReads <= 2 ? currentNow : nextDateNow;
    });

    const result = await drafts.write(
      userId,
      guildId,
      draftWrite(currentDate, 'termo'),
    );

    expect(result).toEqual({ status: 'closed' });
    expect(
      await drafts.getCurrentDraft(userId, guildId, currentDate),
    ).toBeNull();
    expect(await sessionFor(userId, guildId, currentDate)).toBeUndefined();
  });

  it('keeps a correct draft private until cutoff, then records one zero-guess win and award', async () => {
    const { userId, guildId } = identity();
    const day = new WordleDraftService(() => currentNow);
    await seedDay(guildId, currentDate, 'termo');

    const saved = await day.write(
      userId,
      guildId,
      draftWrite(currentDate, 'termo'),
    );
    expect(saved.status).toBe('saved');
    expect(saved).toEqual({
      status: 'saved',
      draft: {
        date: currentDate,
        rowIndex: 0,
        cells: [...'termo'],
        activeIndex: 4,
        revision: 1,
      },
    });
    expect(await sessionFor(userId, guildId, currentDate)).toBeUndefined();
    expect(await achievementXp(userId, guildId)).toBe(0);

    const nextDay = shiftDate(currentDate, 1);
    const finalizer = new WordleDraftService(() =>
      Date.parse(`${nextDay}T15:00:00Z`),
    );
    await Promise.all([
      finalizer.finalizePlayerBefore(userId, guildId, nextDay),
      finalizer.finalizePlayerBefore(userId, guildId, nextDay),
    ]);

    const session = await sessionFor(userId, guildId, currentDate);
    expect(session).toMatchObject({
      solved: true,
      solved_from_draft: true,
      attempts: 0,
      guesses: '[]',
    });
    expect(session?.solved_at).toBe(getWordleDayEndEpoch(currentDate));
    const [daily] = await db
      .select({
        players: wordleDays.players_count,
        winners: wordleDays.winners_count,
        attempts: wordleDays.total_attempts,
      })
      .from(wordleDays)
      .where(
        and(
          eq(wordleDays.guild_id, guildId),
          eq(wordleDays.word_date, currentDate),
        ),
      );
    expect(daily).toEqual({ players: 1, winners: 1, attempts: 0 });
    const [draft] = await db
      .select()
      .from(wordleDrafts)
      .where(
        and(
          eq(wordleDrafts.user_id, userId),
          eq(wordleDrafts.guild_id, guildId),
          eq(wordleDrafts.word_date, currentDate),
        ),
      );
    expect(draft?.finalized_at).not.toBeNull();
    expect(draft?.award_reconciled_at).not.toBeNull();
    const overview = await new WordleAchievementService().getOverview(
      userId,
      guildId,
    );
    expect(overview.stats).toMatchObject({
      played: 1,
      wins: 1,
      distribution: [1, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(
      overview.achievements.find(
        (row) => row.id === 'wordle_v2_zero_attempt_solve',
      )?.unlockedAt,
    ).not.toBeNull();
    expect(
      overview.achievements.every(
        (row) =>
          row.matchEvidence == null &&
          (row.patternPreview === undefined || row.unlockedAt === null),
      ),
    ).toBe(true);
    expect(
      await db
        .select()
        .from(userAchievements)
        .where(
          and(
            eq(userAchievements.user_id, userId),
            eq(userAchievements.achievement_id, 'wordle_v2_solved_exactly_1'),
          ),
        ),
    ).toHaveLength(0);
    const expectedXp = overview.achievements
      .filter((row) => row.unlockedAt !== null)
      .reduce((sum, row) => sum + row.rewardXp, 0);
    expect(await achievementXp(userId, guildId)).toBe(expectedXp);
  });

  it('persists exact gaps and active position, and serializes revision conflicts', async () => {
    const { userId, guildId } = identity();
    const drafts = new WordleDraftService(() => currentNow);
    await seedDay(guildId, currentDate, 'partes');
    const first = await drafts.write(
      userId,
      guildId,
      draftWrite(currentDate, 'partes', {
        cells: ['p', '', 'r', '', 's', ''],
        activeIndex: 3,
      }),
    );
    expect(first.status).toBe('saved');
    const restored = await drafts.getCurrentDraft(userId, guildId, currentDate);
    expect(restored).toEqual({
      date: currentDate,
      rowIndex: 0,
      cells: ['p', '', 'r', '', 's', ''],
      activeIndex: 3,
      revision: 1,
    });
    expect(
      await drafts.getCurrentDraft(userId, `${guildId}-other`, currentDate),
    ).toBeNull();

    const writes = await Promise.all([
      drafts.write(
        userId,
        guildId,
        draftWrite(currentDate, 'partes', {
          cells: [...'cartes'],
          activeIndex: 4,
          expectedRevision: 1,
        }),
      ),
      drafts.write(
        userId,
        guildId,
        draftWrite(currentDate, 'partes', {
          cells: [...'fartes'],
          activeIndex: 4,
          expectedRevision: 1,
        }),
      ),
    ]);
    expect(writes.map((result) => result.status).sort()).toEqual([
      'conflict',
      'saved',
    ]);
    const conflict = writes.find((result) => result.status === 'conflict');
    expect(
      conflict?.status === 'conflict' ? conflict.draft?.revision : null,
    ).toBe(2);
    expect(
      (await drafts.getCurrentDraft(userId, guildId, currentDate))?.revision,
    ).toBe(2);
  });

  it('does not turn incomplete, changed-away, or already-played drafts into zero-guess wins', async () => {
    const incomplete = identity();
    const changed = identity();
    const played = identity();
    const drafts = new WordleDraftService(() => currentNow);
    await Promise.all(
      [incomplete, changed, played].map(({ guildId }) =>
        seedDay(guildId, currentDate, 'partes'),
      ),
    );

    await drafts.write(
      incomplete.userId,
      incomplete.guildId,
      draftWrite(currentDate, 'partes', { cells: ['p', '', '', '', ''] }),
    );
    const correct = await drafts.write(
      changed.userId,
      changed.guildId,
      draftWrite(currentDate, 'partes'),
    );
    expect(correct.status).toBe('saved');
    await drafts.write(
      changed.userId,
      changed.guildId,
      draftWrite(currentDate, 'partes', {
        cells: [...'cartes'],
        expectedRevision: 1,
      }),
    );
    await drafts.write(
      played.userId,
      played.guildId,
      draftWrite(currentDate, 'partes'),
    );

    const submitted = await new WordleService().submitGuess(
      played.userId,
      played.guildId,
      'cartes',
    );
    expect('error' in submitted).toBe(false);
    const nextDay = shiftDate(currentDate, 1);
    const finalizer = new WordleDraftService(() =>
      Date.parse(`${nextDay}T15:00:00Z`),
    );
    await Promise.all([
      finalizer.finalizePlayerBefore(
        incomplete.userId,
        incomplete.guildId,
        nextDay,
      ),
      finalizer.finalizePlayerBefore(changed.userId, changed.guildId, nextDay),
      finalizer.finalizePlayerBefore(played.userId, played.guildId, nextDay),
    ]);
    expect(
      await sessionFor(incomplete.userId, incomplete.guildId, currentDate),
    ).toBeUndefined();
    expect(
      await sessionFor(changed.userId, changed.guildId, currentDate),
    ).toBeUndefined();
    expect(
      await sessionFor(played.userId, played.guildId, currentDate),
    ).toMatchObject({ attempts: 1, solved_from_draft: false });
  });

  it('reconciles a finalized zero-win award after failure without duplicating it', async () => {
    const { userId, guildId } = identity();
    const drafts = new WordleDraftService(() => currentNow);
    await seedDay(guildId, currentDate, 'termo');
    await drafts.write(userId, guildId, draftWrite(currentDate, 'termo'));
    const nextDay = shiftDate(currentDate, 1);
    const finalizer = new WordleDraftService(() =>
      Date.parse(`${nextDay}T15:00:00Z`),
    );
    const failure = spyOn(
      WordleAchievementService.prototype,
      'checkAndAward',
    ).mockImplementationOnce(async () => {
      throw new Error('temporary award failure');
    });
    await finalizer.finalizePlayerBefore(userId, guildId, nextDay);
    failure.mockRestore();
    let [row] = await db
      .select()
      .from(wordleDrafts)
      .where(
        and(
          eq(wordleDrafts.user_id, userId),
          eq(wordleDrafts.guild_id, guildId),
          eq(wordleDrafts.word_date, currentDate),
        ),
      );
    expect(row?.finalized_at).not.toBeNull();
    expect(row?.award_reconciled_at).toBeNull();

    await finalizer.finalizePlayerBefore(userId, guildId, nextDay);
    [row] = await db
      .select()
      .from(wordleDrafts)
      .where(
        and(
          eq(wordleDrafts.user_id, userId),
          eq(wordleDrafts.guild_id, guildId),
          eq(wordleDrafts.word_date, currentDate),
        ),
      );
    expect(row?.award_reconciled_at).not.toBeNull();
    const overview = await new WordleAchievementService().getOverview(
      userId,
      guildId,
    );
    const expectedXp = overview.achievements
      .filter((badge) => badge.unlockedAt !== null)
      .reduce((sum, badge) => sum + badge.rewardXp, 0);
    expect(await achievementXp(userId, guildId)).toBe(expectedXp);
    expect(await sessionFor(userId, guildId, currentDate)).toMatchObject({
      attempts: 0,
      solved_from_draft: true,
    });
  });

  it('uses the oldest eligible draft as first solver independent of worker order', async () => {
    const guildId = randomUUID();
    const first = { userId: randomUUID(), guildId };
    const second = { userId: randomUUID(), guildId };
    const drafts = new WordleDraftService(() => currentNow);
    await Promise.all(
      [first, second].map(({ guildId }) =>
        seedDay(guildId, currentDate, 'termo'),
      ),
    );
    await drafts.write(
      first.userId,
      first.guildId,
      draftWrite(currentDate, 'termo'),
    );
    await drafts.write(
      second.userId,
      second.guildId,
      draftWrite(currentDate, 'termo'),
    );
    await db
      .update(wordleDrafts)
      .set({ updated_at: 10 })
      .where(
        and(
          eq(wordleDrafts.user_id, first.userId),
          eq(wordleDrafts.guild_id, first.guildId),
        ),
      );
    await db
      .update(wordleDrafts)
      .set({ updated_at: 20 })
      .where(
        and(
          eq(wordleDrafts.user_id, second.userId),
          eq(wordleDrafts.guild_id, second.guildId),
        ),
      );
    const nextDay = shiftDate(currentDate, 1);
    const finalizer = new WordleDraftService(() =>
      Date.parse(`${nextDay}T15:00:00Z`),
    );
    await Promise.all([
      finalizer.finalizePlayerBefore(second.userId, second.guildId, nextDay),
      finalizer.finalizePlayerBefore(first.userId, first.guildId, nextDay),
    ]);
    expect(
      (await sessionFor(first.userId, first.guildId, currentDate))
        ?.first_solver,
    ).toBe(true);
    expect(
      (await sessionFor(second.userId, second.guildId, currentDate))
        ?.first_solver,
    ).toBe(false);
  });

  it('keeps an older solved streak when finalizing a zero-guess win before the next solve', async () => {
    const { userId, guildId } = identity();
    await Promise.all([
      seedDay(guildId, olderDate, 'termo'),
      seedDay(guildId, previousDate, 'termo'),
      seedDay(guildId, currentDate, 'partes'),
    ]);
    await db.insert(wordleSessions).values({
      id: crypto.randomUUID(),
      user_id: userId,
      guild_id: guildId,
      word_date: olderDate,
      guesses: '[]',
      solved: true,
      attempts: 1,
      created_at: 1,
      solved_at: 2,
    });
    const drafts = new WordleDraftService(() =>
      Date.parse(`${previousDate}T15:00:00Z`),
    );
    await drafts.write(userId, guildId, draftWrite(previousDate, 'termo'));
    const finalizer = new WordleDraftService(() =>
      Date.parse(`${currentDate}T15:00:00Z`),
    );
    await finalizer.finalizePlayerBefore(userId, guildId, currentDate);

    const answer = resolveCanonical('partes');
    expect(answer).toBe('partes');
    const result = await new WordleService().submitGuess(
      userId,
      guildId,
      answer!,
    );
    expect('error' in result).toBe(false);
    if (!('error' in result)) expect(result.streak).toBe(3);
    expect(await new WordleService().getStreak(userId, guildId)).toMatchObject({
      currentStreak: 3,
      maxStreak: 3,
    });
  });

  it('serializes finalization against the first accepted guess', async () => {
    const { userId, guildId } = identity();
    await seedDay(guildId, currentDate, 'partes');
    await new WordleDraftService(() => currentNow).write(
      userId,
      guildId,
      draftWrite(currentDate, 'partes'),
    );
    const nextDay = shiftDate(currentDate, 1);
    const [guess, _finalized] = await Promise.all([
      new WordleService().submitGuess(userId, guildId, 'cartes'),
      new WordleDraftService(() =>
        Date.parse(`${nextDay}T15:00:00Z`),
      ).finalizePlayerBefore(userId, guildId, nextDay),
    ]);
    const session = await sessionFor(userId, guildId, currentDate);
    expect(session).toBeDefined();
    if (session?.solved_from_draft) {
      expect(session).toMatchObject({
        solved: true,
        attempts: 0,
        guesses: '[]',
      });
      expect('error' in guess).toBe(true);
    } else {
      expect(session).toMatchObject({ solved: false, attempts: 1 });
      expect('error' in guess).toBe(false);
    }
  });

  it('finalizes drafts from older dates when the process catches up after downtime', async () => {
    const { userId, guildId } = identity();
    await seedDay(guildId, currentDate, 'termo');
    await new WordleDraftService(() => currentNow).write(
      userId,
      guildId,
      draftWrite(currentDate, 'termo'),
    );
    const nextDay = shiftDate(currentDate, 1);
    await new WordleDraftService(() =>
      Date.parse(`${nextDay}T15:00:00Z`),
    ).finalizeExpiredDrafts();
    expect(await sessionFor(userId, guildId, currentDate)).toMatchObject({
      solved: true,
      solved_from_draft: true,
      attempts: 0,
    });
  });
});
