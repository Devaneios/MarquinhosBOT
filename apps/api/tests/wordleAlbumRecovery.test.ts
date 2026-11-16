import {
  achievements,
  wordleAlbumMilestones,
  wordleAlbumPages,
  wordleAlbumProjectionQueue,
  wordleCommunityDailyPresence,
  wordleGlobalDays,
  wordleGlobalOccurrences,
  wordleGlobalSessions,
  wordleNotifications,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { WordleReconcileJob } from '../src/jobs/wordle-reconcile.job';
import { enqueueAlbumProjections } from '../src/modules/wordle/community/wordle-album-projection-queue';
import { recordWordlePresence } from '../src/modules/wordle/community/wordle-community.service';
import { createWordleTestServices } from './helpers/wordleServices';

let database: TestDb;
beforeEach(async () => {
  database = await createTestDb();
});
afterEach(async () => {
  await database.drop();
});

describe('Wordle album projection recovery', () => {
  it('completes milestones after a partial projection without duplicating page notifications', async () => {
    const services = createWordleTestServices(database.db);
    const definitions = WORDLE_ACHIEVEMENT_CATALOG.filter(
      (item) => item.kind === 'drawing' && !item.hidden,
    );
    const first = definitions[0];
    if (!first || first.kind !== 'drawing')
      throw new Error('Missing drawing catalog');
    const patterns = definitions.flatMap((item) =>
      item.kind === 'drawing' && item.family === first.family
        ? [item.drawing.patternId]
        : [],
    );
    expect(patterns.length).toBeGreaterThan(0);
    await services.notifications.configure('guild', {
      channelId: null,
      collective: true,
      weekly: false,
    });
    await database.db
      .insert(wordleGlobalOccurrences)
      .values(
        patterns.map((pattern_id) => ({
          user_id: 'player',
          word_date: '2026-10-01',
          pattern_id,
          session_id: 'session',
          occurred_at: 100,
          evidence: {},
        })),
      );
    const failure = spyOn(
      services.albumMilestones,
      'reconcile',
    ).mockRejectedValueOnce(new Error('temporary milestone failure'));
    await recordWordlePresence(
      database.db,
      services.album,
      'player',
      'guild',
      '2026-10-01',
      1,
    );
    expect(await database.db.select().from(wordleAlbumPages)).toHaveLength(
      patterns.length,
    );
    expect(await database.db.select().from(wordleNotifications)).toHaveLength(
      patterns.length,
    );
    expect(await database.db.select().from(wordleAlbumMilestones)).toHaveLength(
      0,
    );
    expect(
      await database.db.select().from(wordleAlbumProjectionQueue),
    ).toHaveLength(1);
    failure.mockRestore();
    await services.album.processPending();
    expect(
      (await database.db.select().from(wordleAlbumMilestones)).find(
        (row) => row.family === first.family,
      )?.status,
    ).toBe('completed');
    expect(await database.db.select().from(wordleNotifications)).toHaveLength(
      patterns.length,
    );
    expect(
      await database.db.select().from(wordleAlbumProjectionQueue),
    ).toHaveLength(0);
  });

  it('queues existing discoveries during migration', async () => {
    await database.db
      .insert(wordleGlobalOccurrences)
      .values({
        user_id: 'player',
        word_date: '2026-10-01',
        pattern_id: 'letter_a',
        session_id: 'session',
        occurred_at: 100,
        evidence: {},
      });
    await database.db
      .insert(wordleCommunityDailyPresence)
      .values({
        user_id: 'player',
        guild_id: 'guild',
        word_date: '2026-10-01',
        first_seen_at: 1,
      });
    await database.db.execute(
      sql.raw('DROP TABLE wordle_album_projection_queue'),
    );
    const migration = await readFile(
      new URL(
        '../../../packages/database/drizzle/0034_wordle_album_projection_queue.sql',
        import.meta.url,
      ),
      'utf8',
    );
    for (const statement of migration
      .split('--> statement-breakpoint')
      .map((part) => part.trim())
      .filter(Boolean)) {
      await database.db.execute(sql.raw(statement));
    }
    expect(
      (await database.db.select().from(wordleAlbumProjectionQueue)).map(
        (row) => row.guild_id,
      ),
    ).toEqual(['guild']);
  });

  it('retains new work that arrives while a projection is running', async () => {
    const services = createWordleTestServices(database.db);
    await enqueueAlbumProjections(database.db, ['guild']);
    const [initial] = await database.db
      .select()
      .from(wordleAlbumProjectionQueue);
    let unblock!: () => void;
    let began!: () => void;
    const release = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    const paused = spyOn(services.album, 'pages').mockImplementation(
      async () => {
        began();
        await release;
        return [];
      },
    );
    const projection = services.album.projectGuild('guild');
    await started;
    await enqueueAlbumProjections(database.db, ['guild']);
    unblock();
    await projection;
    paused.mockRestore();
    const queued = await database.db
      .select()
      .from(wordleAlbumProjectionQueue)
      .where(eq(wordleAlbumProjectionQueue.guild_id, 'guild'));
    expect(queued).toHaveLength(1);
    expect(queued[0]?.revision).not.toBe(initial?.revision);
    await services.album.processPending();
    expect(
      await database.db.select().from(wordleAlbumProjectionQueue),
    ).toHaveLength(0);
  });

  it('does not erase work enqueued after another projection completes', async () => {
    const services = createWordleTestServices(database.db);
    await enqueueAlbumProjections(database.db, ['guild']);
    let unblock!: () => void;
    let began!: () => void;
    const release = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    const paused = spyOn(services.album, 'pages').mockImplementationOnce(
      async () => {
        began();
        await release;
        return [];
      },
    );
    const older = services.album.projectGuild('guild');
    await started;
    await services.album.projectGuild('guild');
    await enqueueAlbumProjections(database.db, ['guild']);
    unblock();
    await older;
    paused.mockRestore();
    expect(
      await database.db.select().from(wordleAlbumProjectionQueue),
    ).toHaveLength(1);
    await services.album.processPending();
    expect(
      await database.db.select().from(wordleAlbumProjectionQueue),
    ).toHaveLength(0);
  });

  it('defers a failing community without blocking another one', async () => {
    let clock = Date.parse('2026-11-01T15:00:00Z');
    const services = createWordleTestServices(database.db, {
      now: () => clock,
    });
    await enqueueAlbumProjections(database.db, ['broken', 'healthy']);
    const original = services.album.pages.bind(services.album);
    const failure = spyOn(services.album, 'pages').mockImplementation(
      async (guild) => {
        if (guild === 'broken') throw new Error('temporary outage');
        return original(guild);
      },
    );
    await services.album.processPending();
    const pending = await database.db.select().from(wordleAlbumProjectionQueue);
    expect(pending.map((row) => row.guild_id)).toEqual(['broken']);
    expect(pending[0]?.retry_at).toBe(clock + 60_000);
    failure.mockRestore();
    await services.album.processPending();
    expect(
      await database.db.select().from(wordleAlbumProjectionQueue),
    ).toHaveLength(1);
    clock += 60_000;
    await services.album.processPending();
    expect(
      await database.db.select().from(wordleAlbumProjectionQueue),
    ).toHaveLength(0);
  });
  it('retries a failed projection after a player joins a community', async () => {
    const services = createWordleTestServices(database.db);
    await database.db
      .insert(wordleGlobalOccurrences)
      .values({
        user_id: 'player',
        word_date: '2026-10-01',
        pattern_id: 'letter_a',
        session_id: 'session',
        occurred_at: 100,
        evidence: {},
      });
    const failure = spyOn(services.album, 'pages').mockRejectedValueOnce(
      new Error('temporary outage'),
    );
    await recordWordlePresence(
      database.db,
      services.album,
      'player',
      'guild',
      '2026-10-01',
      1,
    );
    expect(await services.album.contributions('guild')).toHaveLength(0);
    failure.mockRestore();
    const job = new WordleReconcileJob(
      services.notifications,
      services.goals,
      services.gallery,
      services.globalCoordinator,
      services.album,
    );
    await job.reconcileOnInterval();
    expect(await services.album.contributions('guild')).toHaveLength(1);
  });

  it('retries a failed projection after an achievement discovery commits', async () => {
    const now = Date.parse('2026-11-01T15:00:00Z');
    const services = createWordleTestServices(database.db, {
      now: () => now,
      today: () => '2026-11-01',
    });
    await database.db
      .insert(wordleGlobalDays)
      .values({
        word_date: '2026-11-01',
        word: 'termo',
        word_length: 5,
        created_at: 1,
      });
    await database.db
      .insert(wordleGlobalSessions)
      .values({
        id: 'draw-session',
        user_id: 'artist',
        word_date: '2026-11-01',
        attempts: 1,
        guesses: JSON.stringify([
          {
            guess: 'terma',
            feedback: ['correct', 'correct', 'correct', 'correct', 'absent'],
          },
        ]),
        created_at: 1,
      });
    await database.db
      .insert(achievements)
      .values({
        id: 'wordle_v2_pattern_tetromino_i',
        name: 'I',
        description: 'I',
        category: 'wordle',
        rarity: 'common',
        icon: 'x',
        reward_xp: 25,
      });
    await recordWordlePresence(
      database.db,
      services.album,
      'artist',
      'guild',
      '2026-11-01',
      1,
    );
    const failure = spyOn(services.album, 'pages').mockRejectedValueOnce(
      new Error('temporary outage'),
    );
    expect(
      (await services.globalAchievements.checkAndAward('artist', 'guild'))
        .unlockedIds,
    ).toContain('wordle_v2_pattern_tetromino_i');
    expect(await services.album.contributions('guild')).toHaveLength(0);
    failure.mockRestore();
    const job = new WordleReconcileJob(
      services.notifications,
      services.goals,
      services.gallery,
      services.globalCoordinator,
      services.album,
    );
    await job.reconcileOnInterval();
    expect(
      (await services.album.contributions('guild')).map(
        (item) => item.patternId,
      ),
    ).toContain('tetromino_i');
  });
});
