import {
  wordleCommunityFirstSolves,
  wordleGlobalDays,
  wordleGlobalDrafts,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { recordWordlePresence } from '../src/services/wordle/WordleCommunityService';
import { WordleGlobalDraftService } from '../src/services/wordle/WordleGlobalDraftService';
import { getWordleDayEndEpoch } from '../src/services/wordle/wordleDate';

let testDb: TestDb;
const date = '2026-11-01';
const now = Date.parse('2026-11-01T15:00:00Z');
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.db
    .insert(wordleGlobalDays)
    .values({ word_date: date, word: 'termo', word_length: 5, created_at: 1 });
});
afterAll(async () => {
  await testDb.drop();
});

const draft = {
  date,
  rowIndex: 0,
  cells: ['t', 'e', '', '', ''],
  activeIndex: 2,
  expectedRevision: 0,
};
describe('global drafts', () => {
  it('does not award a draft recorded after the day ended', async () => {
    const writer = new WordleGlobalDraftService(testDb.db, () => now);
    await writer.write('late-draft', {
      ...draft,
      cells: ['t', 'e', 'r', 'm', 'o'],
      activeIndex: 4,
    });
    await testDb.db
      .update(wordleGlobalDrafts)
      .set({ updated_at: getWordleDayEndEpoch(date) + 1 })
      .where(eq(wordleGlobalDrafts.user_id, 'late-draft'));
    await new WordleGlobalDraftService(
      testDb.db,
      () => now + 86400000,
      async () => {},
    ).finalizePlayerBefore('late-draft', '2026-11-02');
    const session = (await testDb.db.select().from(wordleGlobalSessions)).find(
      (row) => row.user_id === 'late-draft',
    );
    expect(session).toBeUndefined();
  });
  it('settles a winning draft whose player has no community presence', async () => {
    await new WordleGlobalDraftService(testDb.db, () => now).write(
      'no-presence',
      { ...draft, cells: ['t', 'e', 'r', 'm', 'o'], activeIndex: 4 },
    );
    let awards = 0;
    const finalizer = new WordleGlobalDraftService(
      testDb.db,
      () => now + 86400000,
      async () => {
        awards++;
      },
    );
    await finalizer.finalizePlayerBefore('no-presence', '2026-11-02');
    const [row] = await testDb.db
      .select()
      .from(wordleGlobalDrafts)
      .where(eq(wordleGlobalDrafts.user_id, 'no-presence'));
    expect(row?.finalized_at).not.toBeNull();
    expect(row?.award_reconciled_at).not.toBeNull();
    expect(awards).toBe(0);
    const session = (await testDb.db.select().from(wordleGlobalSessions)).find(
      (session) => session.user_id === 'no-presence',
    );
    expect(session).toMatchObject({ solved: true, solved_from_draft: true });
  });
  it('does not turn a draft into a win after an accepted guess', async () => {
    const writer = new WordleGlobalDraftService(testDb.db, () => now);
    await testDb.db.insert(wordleGlobalSessions).values({
      id: 'played-session',
      user_id: 'played',
      word_date: date,
      attempts: 1,
      created_at: 1,
    });
    await writer.write('played', {
      ...draft,
      rowIndex: 1,
      cells: ['t', 'e', 'r', 'm', 'o'],
      activeIndex: 4,
    });
    let awards = 0;
    await new WordleGlobalDraftService(
      testDb.db,
      () => now + 86400000,
      async () => {
        awards++;
      },
    ).finalizePlayerBefore('played', '2026-11-02');
    const session = (await testDb.db.select().from(wordleGlobalSessions)).find(
      (row) => row.user_id === 'played',
    );
    expect(session).toMatchObject({ solved: false, attempts: 1 });
    expect(awards).toBe(0);
  });
  it('finalizes an existing empty session from a winning draft', async () => {
    await recordWordlePresence(
      testDb.db,
      'empty-session',
      'empty-community',
      date,
      Math.floor(now / 1000),
    );
    const writer = new WordleGlobalDraftService(testDb.db, () => now);
    await writer.write('empty-session', {
      ...draft,
      cells: ['t', 'e', 'r', 'm', 'o'],
      activeIndex: 4,
    });
    await testDb.db.insert(wordleGlobalSessions).values({
      id: 'empty-existing',
      user_id: 'empty-session',
      word_date: date,
      attempts: 0,
      created_at: 1,
    });
    await new WordleGlobalDraftService(
      testDb.db,
      () => now + 86400000,
      async () => {},
    ).finalizePlayerBefore('empty-session', '2026-11-02');
    const session = (await testDb.db.select().from(wordleGlobalSessions)).find(
      (row) => row.user_id === 'empty-session',
    );
    expect(session).toMatchObject({
      id: 'empty-existing',
      solved: true,
      solved_from_draft: true,
      attempts: 0,
    });
  });

  it('assigns first solver to the earliest winning draft regardless of finalization order', async () => {
    const timestamp = Math.floor(now / 1000);
    await recordWordlePresence(
      testDb.db,
      'early',
      'draft-order',
      date,
      timestamp,
    );
    await recordWordlePresence(
      testDb.db,
      'late',
      'draft-order',
      date,
      timestamp,
    );
    const input = {
      ...draft,
      cells: ['t', 'e', 'r', 'm', 'o'],
      activeIndex: 4,
    };
    await new WordleGlobalDraftService(testDb.db, () => now).write(
      'early',
      input,
    );
    await new WordleGlobalDraftService(testDb.db, () => now + 1000).write(
      'late',
      input,
    );
    const finalizer = new WordleGlobalDraftService(
      testDb.db,
      () => now + 86400000,
      async () => {},
    );
    await finalizer.finalizePlayerBefore('late', '2026-11-02');
    await finalizer.finalizePlayerBefore('early', '2026-11-02');
    const winner = (
      await testDb.db.select().from(wordleCommunityFirstSolves)
    ).find((row) => row.guild_id === 'draft-order');
    expect(winner?.user_id).toBe('early');
  });
  it('finalizes a complete draft once and retries failed awards', async () => {
    const timestamp = Math.floor(now / 1000);
    await recordWordlePresence(
      testDb.db,
      'draft-winner',
      'community',
      date,
      timestamp,
    );
    const writer = new WordleGlobalDraftService(testDb.db, () => now);
    expect(
      (
        await writer.write('draft-winner', {
          ...draft,
          cells: ['t', 'e', 'r', 'm', 'o'],
          activeIndex: 4,
        })
      ).status,
    ).toBe('saved');
    let attempts = 0;
    const finalizer = new WordleGlobalDraftService(
      testDb.db,
      () => now + 86400000,
      async () => {
        attempts++;
        if (attempts === 1) throw new Error('temporary');
      },
    );
    await finalizer.finalizePlayerBefore('draft-winner', '2026-11-02');
    const [session] = (
      await testDb.db.select().from(wordleGlobalSessions)
    ).filter((row) => row.user_id === 'draft-winner');
    expect(session).toMatchObject({
      solved: true,
      solved_from_draft: true,
      attempts: 0,
    });
    await finalizer.finalizePlayerBefore('draft-winner', '2026-11-02');
    await finalizer.finalizePlayerBefore('draft-winner', '2026-11-02');
    expect(attempts).toBe(2);
    expect(
      (await testDb.db.select().from(wordleGlobalSessions)).filter(
        (row) => row.user_id === 'draft-winner',
      ),
    ).toHaveLength(1);
  });
  it('saves a single draft per player and rejects stale edits', async () => {
    const service = new WordleGlobalDraftService(testDb.db, () => now);
    const first = await service.write('player', draft);
    expect(first.status).toBe('saved');
    const stale = await service.write('player', draft);
    expect(stale.status).toBe('conflict');
    expect(
      await service.getCurrentDraft('player', date, 0, false),
    ).toMatchObject({ cells: draft.cells, revision: 1 });
  });

  it('serializes simultaneous writes from different clients', async () => {
    const service = new WordleGlobalDraftService(testDb.db, () => now);
    const results = await Promise.all([
      service.write('concurrent', draft),
      service.write('concurrent', draft),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'conflict',
      'saved',
    ]);
  });

  it('refuses drafts for a solved session or a different day', async () => {
    await testDb.db.insert(wordleGlobalSessions).values({
      id: 'solved-session',
      user_id: 'solved',
      word_date: date,
      solved: true,
      attempts: 1,
      created_at: 1,
    });
    const service = new WordleGlobalDraftService(testDb.db, () => now);
    expect(await service.write('solved', draft)).toEqual({ status: 'closed' });
    expect(
      await service.write('another', { ...draft, date: '2026-10-31' }),
    ).toEqual({ status: 'closed' });
  });

  it('rolls back a draft when the day changes before commit', async () => {
    let calls = 0;
    const service = new WordleGlobalDraftService(testDb.db, () =>
      ++calls <= 5 ? now : now + 24 * 60 * 60 * 1000,
    );
    expect(await service.write('cutoff', draft)).toEqual({ status: 'closed' });
    expect(await service.getCurrentDraft('cutoff', date, 0, false)).toBeNull();
  });
});
