import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import { ResearchJobStore } from 'services/aiChat/research/ResearchJobStore';

function freshDb(): Database {
  const db = new Database(':memory:');
  db.run(`
    CREATE TABLE ai_research_jobs (
      job_id TEXT NOT NULL PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      thread_id TEXT NOT NULL, user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
      query TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','error')),
      report TEXT, sources TEXT, stats TEXT, error TEXT,
      created_at INTEGER NOT NULL, finished_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE ai_research_events (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
      seq INTEGER NOT NULL, stage TEXT NOT NULL, message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  return db;
}

const input = {
  idempotencyKey: 'interaction-1',
  threadId: 'thread-1',
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  query: 'estado da arte de X',
};

let store: ResearchJobStore;

beforeEach(() => {
  store = new ResearchJobStore(freshDb());
});

describe('ResearchJobStore.create', () => {
  it('creates a queued job', () => {
    const { job, created } = store.create(input);

    expect(created).toBe(true);
    expect(job).toMatchObject({
      threadId: 'thread-1',
      userId: 'user-1',
      query: 'estado da arte de X',
      status: 'queued',
    });
    expect(job.jobId).toBeTruthy();
  });

  it('returns the same job for a repeated idempotency key, so a retry cannot start two jobs', () => {
    const first = store.create(input);
    const second = store.create(input);

    expect(second.created).toBe(false);
    expect(second.job.jobId).toBe(first.job.jobId);
  });

  it('creates separate jobs for different idempotency keys', () => {
    const first = store.create(input);
    const second = store.create({ ...input, idempotencyKey: 'interaction-2' });

    expect(second.created).toBe(true);
    expect(second.job.jobId).not.toBe(first.job.jobId);
  });
});

describe('ResearchJobStore lifecycle', () => {
  it('reads back a job by id', () => {
    const { job } = store.create(input);

    expect(store.get(job.jobId)?.jobId).toBe(job.jobId);
  });

  it('returns null for a job that does not exist', () => {
    expect(store.get('nao-existe')).toBeNull();
  });

  it('marks a job running', () => {
    const { job } = store.create(input);

    store.markRunning(job.jobId);

    expect(store.get(job.jobId)?.status).toBe('running');
  });

  it('stores the report, sources and stats on completion', () => {
    const { job } = store.create(input);

    store.complete(job.jobId, {
      report: '## Resumo\n\nachei [1].',
      sources: [{ index: 1, url: 'https://a.com', title: 'A' }],
      stats: {
        rounds: 2,
        searches: 5,
        fetched: 8,
        relevantSources: 1,
        maxDepth: 1,
        durationMs: 1234,
      },
    });

    const done = store.get(job.jobId)!;
    expect(done.status).toBe('done');
    expect(done.report).toContain('achei [1]');
    expect(done.sources).toEqual([
      { index: 1, url: 'https://a.com', title: 'A' },
    ]);
    expect(done.stats).toMatchObject({ rounds: 2, searches: 5, fetched: 8 });
    expect(done.finishedAt).toBeGreaterThan(0);
  });

  it('stores the error message on failure', () => {
    const { job } = store.create(input);

    store.fail(job.jobId, 'openai down');

    const failed = store.get(job.jobId)!;
    expect(failed.status).toBe('error');
    expect(failed.error).toBe('openai down');
    expect(failed.finishedAt).toBeGreaterThan(0);
  });

  it('leaves optional fields undefined while the job is still queued', () => {
    const { job } = store.create(input);

    const queued = store.get(job.jobId)!;
    expect(queued.report).toBeUndefined();
    expect(queued.sources).toBeUndefined();
    expect(queued.error).toBeUndefined();
    expect(queued.finishedAt).toBeUndefined();
  });
});

describe('ResearchJobStore progress events', () => {
  it('records events in order with increasing seq', () => {
    const { job } = store.create(input);

    store.addEvent(job.jobId, 'plan', 'plano tracado');
    store.addEvent(job.jobId, 'search', 'buscando');

    const events = store.events(job.jobId);
    expect(events.map((e) => [e.seq, e.stage])).toEqual([
      [1, 'plan'],
      [2, 'search'],
    ]);
  });

  it('returns only events after the given seq, so a poller does not repost', () => {
    const { job } = store.create(input);
    store.addEvent(job.jobId, 'plan', 'a');
    store.addEvent(job.jobId, 'search', 'b');
    store.addEvent(job.jobId, 'read', 'c');

    const fresh = store.events(job.jobId, 2);

    expect(fresh.map((e) => e.stage)).toEqual(['read']);
  });

  it('keeps events of different jobs apart', () => {
    const first = store.create(input);
    const second = store.create({ ...input, idempotencyKey: 'other' });
    store.addEvent(first.job.jobId, 'plan', 'do primeiro');
    store.addEvent(second.job.jobId, 'plan', 'do segundo');

    expect(store.events(first.job.jobId)).toHaveLength(1);
    expect(store.events(first.job.jobId)[0]?.message).toBe('do primeiro');
  });

  it('returns an empty list for a job with no events yet', () => {
    const { job } = store.create(input);

    expect(store.events(job.jobId)).toEqual([]);
  });
});

describe('ResearchJobStore.findStale', () => {
  it('finds queued and running jobs, which is what a restart orphans', () => {
    const queued = store.create(input);
    const running = store.create({ ...input, idempotencyKey: 'b' });
    store.markRunning(running.job.jobId);

    const stale = store
      .findStale()
      .map((job) => job.jobId)
      .sort();

    expect(stale).toEqual([queued.job.jobId, running.job.jobId].sort());
  });

  it('ignores finished jobs', () => {
    const done = store.create(input);
    store.complete(done.job.jobId, {
      report: 'r',
      sources: [],
      stats: {
        rounds: 1,
        searches: 1,
        fetched: 1,
        relevantSources: 0,
        maxDepth: 0,
        durationMs: 1,
      },
    });
    const failed = store.create({ ...input, idempotencyKey: 'b' });
    store.fail(failed.job.jobId, 'x');

    expect(store.findStale()).toEqual([]);
  });
});
