import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { AiChatService } from 'services/aiChat/AiChatService';
import type { ResearchOrchestrator } from 'services/aiChat/research/ResearchOrchestrator';
import type { AiThreadService } from 'services/aiChat/thread/AiThreadService';
import { startContractServer } from '../helpers/contractServer';

const { callContract, HttpError } = await import('@marquinhos/api-client/bot');
const aiChat = await import('@marquinhos/contracts/http/routes/aiChat');

const fakeChat = {
  respond: async () => ({
    status: 'ok',
    category: 'praise_thanks',
    reply: 'valeu!',
    format: 'text',
    traceId: 'trace-1',
  }),
} as unknown as AiChatService;

const fakeThreads = {
  ask: async () => ({ status: 'rate_limited' }),
} as unknown as AiThreadService;

const fakeResearch = {
  start: () => ({ status: 'accepted', jobId: 'job-1', created: true }),
  get: (jobId: string) =>
    jobId === 'job-1'
      ? {
          jobId: 'job-1',
          threadId: 't1',
          userId: 'u1',
          guildId: 'g1',
          channelId: 'c1',
          query: 'estado da arte',
          status: 'done',
          report: 'relatório',
          sources: [{ index: 1, url: 'https://a.com', title: 'A' }],
          createdAt: 1,
          finishedAt: 2,
          progress: [{ seq: 1, stage: 'plan', message: 'ok', createdAt: 1 }],
        }
      : null,
} as unknown as ResearchOrchestrator;

let server: Awaited<ReturnType<typeof startContractServer>>;

beforeAll(async () => {
  const { createAiChatRouter } = await import('../../src/routes/aiChat.route');
  const { default: AiChatController } =
    await import('../../src/controllers/aiChat.controller');
  const { AiTraceQuery } =
    await import('../../src/services/aiChat/AiTraceQuery');
  server = await startContractServer((app) => {
    app.use(
      '/api/ai-chat',
      createAiChatRouter(
        new AiChatController(
          fakeChat,
          new AiTraceQuery(),
          fakeThreads,
          fakeResearch,
        ),
      ),
    );
  });
});

afterAll(() => server.close());

const threadBody = {
  threadId: 't1',
  guildId: 'g1',
  channelId: 'c1',
  userId: 'u1',
};

describe('ai chat contracts', () => {
  it('delivers every category the API classifies into, including praise_thanks', async () => {
    const response = await callContract(server.http, aiChat.respond, {
      body: {
        userId: 'u1',
        guildId: 'g1',
        channelId: 'c1',
        content: 'valeu marquinhos',
        recentMessages: [],
      },
    });

    expect(response.data).toEqual({
      status: 'ok',
      category: 'praise_thanks',
      reply: 'valeu!',
      format: 'text',
      traceId: 'trace-1',
    });
  });

  it('asks in a thread', async () => {
    const response = await callContract(server.http, aiChat.askInThread, {
      body: { ...threadBody, content: 'e aí?' },
    });

    expect(response.data).toEqual({ status: 'rate_limited' });
  });

  it('rejects an invalid body with the validation envelope', async () => {
    const error = await callContract(server.http, aiChat.askInThread, {
      body: { ...threadBody, content: '' },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error instanceof HttpError && error.response?.status).toBe(400);
  });

  it('starts research and polls the job view', async () => {
    const started = await callContract(server.http, aiChat.startResearch, {
      body: { ...threadBody, query: 'estado da arte', idempotencyKey: 'i-1' },
    });
    const job = await callContract(server.http, aiChat.getResearchJob, {
      params: { jobId: 'job-1' },
    });

    expect(started.data).toEqual({
      status: 'accepted',
      jobId: 'job-1',
      created: true,
    });
    expect(job.data.status).toBe('done');
    expect(job.data.sources).toEqual([
      { index: 1, url: 'https://a.com', title: 'A' },
    ]);
    expect(job.data.progress).toHaveLength(1);
  });

  it('lists traces', async () => {
    const response = await callContract(server.http, aiChat.listTraces, {
      query: { limit: 5 },
    });

    expect(Array.isArray(response.data)).toBe(true);
  });
});
