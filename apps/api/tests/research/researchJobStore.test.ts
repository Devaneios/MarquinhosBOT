import { beforeEach, describe, expect, it } from 'bun:test';
import { ResearchJobStore } from 'services/aiChat/research/ResearchJobStore';
import { useTestDb } from '../helpers/testDb';

const testDb = useTestDb();

const input = {
  idempotencyKey: 'interaction-1',
  threadId: 'thread-1',
  userId: 'user-1',
  guildId: 'guild-1',
  channelId: 'channel-1',
  query: 'estado da arte de X',
};

let store: ResearchJobStore;

beforeEach(async () => {
  store = new ResearchJobStore(testDb.current.db);
});

describe('ResearchJobStore.create', () => {
  it('creates a queued job', async () => {
    const { job, created } = await store.create(input);

    expect(created).toBe(true);
    expect(job).toMatchObject({
      threadId: 'thread-1',
      userId: 'user-1',
      query: 'estado da arte de X',
      status: 'queued',
    });
    expect(job.jobId).toBeTruthy();
  });

  it('returns the same job for a repeated idempotency key, so a retry cannot start two jobs', async () => {
    const first = await store.create(input);
    const second = await store.create(input);

    expect(second.created).toBe(false);
    expect(second.job.jobId).toBe(first.job.jobId);
  });

  it('creates separate jobs for different idempotency keys', async () => {
    const first = await store.create(input);
    const second = await store.create({
      ...input,
      idempotencyKey: 'interaction-2',
    });

    expect(second.created).toBe(true);
    expect(second.job.jobId).not.toBe(first.job.jobId);
  });
});

describe('ResearchJobStore lifecycle', () => {
  it('reads back a job by id', async () => {
    const { job } = await store.create(input);

    expect((await store.get(job.jobId))?.jobId).toBe(job.jobId);
  });

  it('returns null for a job that does not exist', async () => {
    expect(await store.get('nao-existe')).toBeNull();
  });

  it('marks a job running', async () => {
    const { job } = await store.create(input);

    await store.markRunning(job.jobId);

    expect((await store.get(job.jobId))?.status).toBe('running');
  });

  it('stores the report, sources and stats on completion', async () => {
    const { job } = await store.create(input);

    await store.complete(job.jobId, {
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

    const done = (await store.get(job.jobId))!;
    expect(done.status).toBe('done');
    expect(done.report).toContain('achei [1]');
    expect(done.sources).toEqual([
      { index: 1, url: 'https://a.com', title: 'A' },
    ]);
    expect(done.stats).toMatchObject({ rounds: 2, searches: 5, fetched: 8 });
    expect(done.finishedAt).toBeGreaterThan(0);
  });

  it('stores the error message on failure', async () => {
    const { job } = await store.create(input);

    await store.fail(job.jobId, 'openai down');

    const failed = (await store.get(job.jobId))!;
    expect(failed.status).toBe('error');
    expect(failed.error).toBe('openai down');
    expect(failed.finishedAt).toBeGreaterThan(0);
  });

  it('leaves optional fields undefined while the job is still queued', async () => {
    const { job } = await store.create(input);

    const queued = (await store.get(job.jobId))!;
    expect(queued.report).toBeUndefined();
    expect(queued.sources).toBeUndefined();
    expect(queued.error).toBeUndefined();
    expect(queued.finishedAt).toBeUndefined();
  });
});

describe('ResearchJobStore progress events', () => {
  it('records events in order with increasing seq', async () => {
    const { job } = await store.create(input);

    await store.addEvent(job.jobId, 'plan', 'plano tracado');
    await store.addEvent(job.jobId, 'search', 'buscando');

    const events = await store.events(job.jobId);
    expect(events.map((e) => [e.seq, e.stage])).toEqual([
      [1, 'plan'],
      [2, 'search'],
    ]);
  });

  it('returns only events after the given seq, so a poller does not repost', async () => {
    const { job } = await store.create(input);
    await store.addEvent(job.jobId, 'plan', 'a');
    await store.addEvent(job.jobId, 'search', 'b');
    await store.addEvent(job.jobId, 'read', 'c');

    const fresh = await store.events(job.jobId, 2);

    expect(fresh.map((e) => e.stage)).toEqual(['read']);
  });

  it('keeps events of different jobs apart', async () => {
    const first = await store.create(input);
    const second = await store.create({ ...input, idempotencyKey: 'other' });
    await store.addEvent(first.job.jobId, 'plan', 'do primeiro');
    await store.addEvent(second.job.jobId, 'plan', 'do segundo');

    expect(await store.events(first.job.jobId)).toHaveLength(1);
    expect((await store.events(first.job.jobId))[0]?.message).toBe(
      'do primeiro',
    );
  });

  it('returns an empty list for a job with no events yet', async () => {
    const { job } = await store.create(input);

    expect(await store.events(job.jobId)).toEqual([]);
  });
});

describe('ResearchJobStore.findStale', () => {
  it('finds queued and running jobs, which is what a restart orphans', async () => {
    const queued = await store.create(input);
    const running = await store.create({ ...input, idempotencyKey: 'b' });
    await store.markRunning(running.job.jobId);

    const stale = (await store.findStale()).map((job) => job.jobId).sort();

    expect(stale).toEqual([queued.job.jobId, running.job.jobId].sort());
  });

  it('ignores finished jobs', async () => {
    const done = await store.create(input);
    await store.complete(done.job.jobId, {
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
    const failed = await store.create({ ...input, idempotencyKey: 'b' });
    await store.fail(failed.job.jobId, 'x');

    expect(await store.findStale()).toEqual([]);
  });
});
