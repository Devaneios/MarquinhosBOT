import type { AiThreadChannel } from '@marquinhos/services/aiChat/aiThread';
import {
  followResearchJob,
  formatProgress,
  formatSources,
  formatStats,
} from '@marquinhos/services/aiChat/researchProgress';
import type { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import type { ResearchJobResponse } from '@marquinhos/types';
import { describe, expect, it } from 'bun:test';

function makeThread() {
  const sent: string[] = [];
  return {
    id: 'thread-1',
    guildId: 'guild-1',
    parentId: 'channel-1',
    sent,
    async sendTyping() {
      return undefined;
    },
    async send(payload: unknown) {
      sent.push(String(payload));
      return undefined;
    },
    client: { user: { displayAvatarURL: () => 'https://avatar' } },
  } as unknown as AiThreadChannel & { sent: string[] };
}

function job(
  overrides: Partial<ResearchJobResponse> = {},
): ResearchJobResponse {
  return {
    jobId: 'job-1',
    status: 'running',
    query: 'estado da arte de X',
    progress: [],
    ...overrides,
  };
}

function makeApi(responses: ResearchJobResponse[]) {
  let call = 0;
  const api = {
    getResearchJob: async () => ({
      data: responses[Math.min(call++, responses.length - 1)],
    }),
  } as unknown as Pick<MarquinhosApiService, 'getResearchJob'>;
  return api;
}

const noWait = async () => undefined;

describe('formatProgress', () => {
  it('labels a known stage with an icon', () => {
    expect(formatProgress('plan', 'tracei o plano')).toContain('Plano');
    expect(formatProgress('plan', 'tracei o plano')).toContain(
      'tracei o plano',
    );
  });

  it('falls back to the raw stage name for an unknown stage', () => {
    expect(formatProgress('novidade', 'msg')).toContain('novidade');
  });
});

describe('formatSources', () => {
  it('renders numbered markdown links matching the citation numbers', () => {
    const text = formatSources([
      { index: 1, url: 'https://a.com', title: 'Fonte A' },
      {
        index: 2,
        url: 'https://b.com',
        title: 'Fonte B',
        publishedDate: '2026-01-02',
      },
    ]);

    expect(text).toContain('## Fontes');
    expect(text).toContain('1. [Fonte A](https://a.com)');
    expect(text).toContain('2. [Fonte B](https://b.com) — 2026-01-02');
  });
});

describe('formatStats', () => {
  it('summarizes the effort spent', () => {
    const text = formatStats({
      rounds: 2,
      searches: 6,
      fetched: 10,
      relevantSources: 7,
      maxDepth: 2,
      durationMs: 95_000,
    });

    expect(text).toContain('7 fonte(s) úteis');
    expect(text).toContain('6 busca(s)');
    expect(text).toContain('profundidade 2');
    expect(text).toContain('95s');
  });

  it('warns when the research was cut short', () => {
    const text = formatStats({
      rounds: 3,
      searches: 12,
      fetched: 24,
      relevantSources: 5,
      maxDepth: 1,
      durationMs: 480_000,
      truncatedByBudget: true,
    });

    expect(text).toContain('limite');
  });
});

describe('followResearchJob', () => {
  it('posts progress events and then the finished report', async () => {
    const thread = makeThread();
    const api = makeApi([
      job({
        progress: [{ seq: 1, stage: 'plan', message: 'plano', createdAt: 1 }],
      }),
      job({
        status: 'done',
        progress: [
          { seq: 1, stage: 'plan', message: 'plano', createdAt: 1 },
          { seq: 2, stage: 'synthesize', message: 'escrevendo', createdAt: 2 },
        ],
        report: '## Resumo\n\nachei isso [1].',
        sources: [{ index: 1, url: 'https://a.com', title: 'Fonte A' }],
        stats: {
          rounds: 1,
          searches: 2,
          fetched: 3,
          relevantSources: 1,
          maxDepth: 0,
          durationMs: 5000,
        },
      }),
    ]);

    const result = await followResearchJob(thread, 'job-1', {
      apiService: api,
      wait: noWait,
    });

    expect(result?.status).toBe('done');
    const all = thread.sent.join('\n');
    expect(all).toContain('plano');
    expect(all).toContain('escrevendo');
    expect(all).toContain('achei isso [1]');
    expect(all).toContain('[Fonte A](https://a.com)');
    expect(all).toContain('1 fonte(s) úteis');
  });

  it('never posts the same progress event twice', async () => {
    const progress = [
      { seq: 1, stage: 'plan', message: 'plano unico', createdAt: 1 },
    ];
    const thread = makeThread();
    const api = makeApi([
      job({ progress }),
      job({ progress }),
      job({ status: 'done', progress, report: 'relatorio' }),
    ]);

    await followResearchJob(thread, 'job-1', { apiService: api, wait: noWait });

    const occurrences = thread.sent.filter((m) => m.includes('plano unico'));
    expect(occurrences).toHaveLength(1);
  });

  it('reports the API error message when the job fails', async () => {
    const thread = makeThread();
    const api = makeApi([
      job({ status: 'error', error: 'searxng fora do ar' }),
    ]);

    await followResearchJob(thread, 'job-1', { apiService: api, wait: noWait });

    expect(thread.sent.join('\n')).toContain('searxng fora do ar');
  });

  it('posts a fallback when the job failed without a message', async () => {
    const thread = makeThread();
    const api = makeApi([job({ status: 'error' })]);

    await followResearchJob(thread, 'job-1', { apiService: api, wait: noWait });

    expect(thread.sent).toHaveLength(1);
  });

  it('keeps polling through a transient poll failure', async () => {
    const thread = makeThread();
    let call = 0;
    const api = {
      getResearchJob: async () => {
        call++;
        if (call === 1) throw new Error('502 do proxy');
        return { data: job({ status: 'done', report: 'chegou o relatorio' }) };
      },
    } as unknown as Pick<MarquinhosApiService, 'getResearchJob'>;

    const result = await followResearchJob(thread, 'job-1', {
      apiService: api,
      wait: noWait,
    });

    expect(result?.status).toBe('done');
    expect(thread.sent.join('\n')).toContain('chegou o relatorio');
  });

  it('gives up with a message once it passes the polling timeout', async () => {
    const thread = makeThread();
    const api = makeApi([job({ status: 'running' })]);
    let current = 0;
    const now = () => {
      const value = current;
      current += 60_000;
      return value;
    };

    const result = await followResearchJob(thread, 'job-1', {
      apiService: api,
      wait: noWait,
      now,
      timeoutMs: 120_000,
    });

    expect(result).toBeNull();
    expect(thread.sent.join('\n')).toContain('passou do tempo');
  });

  it('does not post a sources block when there are no sources', async () => {
    const thread = makeThread();
    const api = makeApi([
      job({ status: 'done', report: 'nao achei nada', sources: [] }),
    ]);

    await followResearchJob(thread, 'job-1', { apiService: api, wait: noWait });

    expect(thread.sent.join('\n')).not.toContain('## Fontes');
  });

  it('splits a report too long for one Discord message', async () => {
    const thread = makeThread();
    const long = Array.from({ length: 400 }, (_, i) => `achado ${i}`).join(
      '\n',
    );
    const api = makeApi([job({ status: 'done', report: long })]);

    await followResearchJob(thread, 'job-1', { apiService: api, wait: noWait });

    expect(thread.sent.length).toBeGreaterThan(1);
    for (const chunk of thread.sent) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });
});
