import { describe, expect, it, mock } from 'bun:test';
import AiChatController from 'controllers/aiChat.controller';
import type { AiChatService } from 'services/aiChat/AiChatService';
import type { AiTraceQuery } from 'services/aiChat/AiTraceQuery';
import type { ResearchOrchestrator } from 'services/aiChat/research/ResearchOrchestrator';
import type { AiThreadService } from 'services/aiChat/thread/AiThreadService';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeReq(
  body: Record<string, unknown>,
  params: Record<string, string> = {},
) {
  return { body, params } as any;
}

function makeRes() {
  let statusCode: number | undefined;
  let payload: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: unknown) {
      payload = data;
      return res;
    },
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
  return res;
}

const stubService = {} as unknown as AiChatService;
const stubTraceQuery = {} as unknown as AiTraceQuery;

function controllerWith(
  threadService: Partial<AiThreadService>,
  research: Partial<ResearchOrchestrator> = {},
) {
  return new AiChatController(
    stubService,
    stubTraceQuery,
    threadService as AiThreadService,
    research as ResearchOrchestrator,
  );
}

const askBody = {
  threadId: 't1',
  guildId: 'g1',
  channelId: 'c1',
  userId: 'u1',
  content: 'quanto é 2+2?',
};

describe('AiChatController.askInThread', () => {
  it('returns 200 with the service result as data', async () => {
    const ask = mock(async () => ({
      status: 'ok' as const,
      reply: '4',
      format: 'text' as const,
    }));
    const res = makeRes();

    await controllerWith({ ask }).askInThread(makeReq(askBody), res as any);

    expect(res.getStatus()).toBe(200);
    expect(res.getPayload()).toEqual({
      data: { status: 'ok', reply: '4', format: 'text' },
    });
  });

  it('forwards the whole thread payload to the service', async () => {
    const ask = mock(async () => ({ status: 'ok' as const, reply: 'x' }));

    await controllerWith({ ask }).askInThread(
      makeReq({ ...askBody, mode: 'research' }),
      makeRes() as any,
    );

    expect(ask).toHaveBeenCalledWith({
      threadId: 't1',
      guildId: 'g1',
      channelId: 'c1',
      userId: 'u1',
      content: 'quanto é 2+2?',
      mode: 'research',
    });
  });

  it('passes a rate_limited result through as 200, not as an error', async () => {
    const ask = mock(async () => ({ status: 'rate_limited' as const }));
    const res = makeRes();

    await controllerWith({ ask }).askInThread(makeReq(askBody), res as any);

    expect(res.getStatus()).toBe(200);
    expect(res.getPayload()).toEqual({ data: { status: 'rate_limited' } });
  });

  it('returns 500 without leaking the error when the service throws', async () => {
    const ask = mock(async () => {
      throw new Error('boom interno');
    });
    const res = makeRes();

    await controllerWith({ ask }).askInThread(makeReq(askBody), res as any);

    expect(res.getStatus()).toBe(500);
    expect(JSON.stringify(res.getPayload())).not.toContain('boom interno');
  });
});

const researchBody = {
  threadId: 't1',
  guildId: 'g1',
  channelId: 'c1',
  userId: 'u1',
  query: 'estado da arte de X',
  idempotencyKey: 'interaction-1',
};

describe('AiChatController.startResearch', () => {
  it('returns 202 with the job id when the job is accepted', async () => {
    const start = mock(() => ({
      status: 'accepted' as const,
      jobId: 'job-1',
      created: true,
    }));
    const res = makeRes();

    await controllerWith({}, { start }).startResearch(
      makeReq(researchBody),
      res as any,
    );

    expect(res.getStatus()).toBe(202);
    expect(res.getPayload()).toEqual({
      data: { status: 'accepted', jobId: 'job-1', created: true },
    });
  });

  it('reports created false for a retried idempotency key', async () => {
    const start = mock(() => ({
      status: 'accepted' as const,
      jobId: 'job-1',
      created: false,
    }));
    const res = makeRes();

    await controllerWith({}, { start }).startResearch(
      makeReq(researchBody),
      res as any,
    );

    expect((res.getPayload() as any).data.created).toBe(false);
  });

  it('returns 200 rate_limited when the daily limit is spent', async () => {
    const start = mock(() => ({ status: 'rate_limited' as const }));
    const res = makeRes();

    await controllerWith({}, { start }).startResearch(
      makeReq(researchBody),
      res as any,
    );

    expect(res.getStatus()).toBe(200);
    expect(res.getPayload()).toEqual({ data: { status: 'rate_limited' } });
  });

  it('returns 200 rejected with the roast when the query is an injection attempt', async () => {
    const start = mock(() => ({
      status: 'rejected' as const,
      reply: 'Trouxa, eu sou filho do Rei :P',
    }));
    const res = makeRes();

    await controllerWith({}, { start }).startResearch(
      makeReq(researchBody),
      res as any,
    );

    expect(res.getStatus()).toBe(200);
    expect((res.getPayload() as any).data.reply).toContain('filho do Rei');
  });

  it('returns 500 when the orchestrator throws', async () => {
    const start = mock(() => {
      throw new Error('db down');
    });
    const res = makeRes();

    await controllerWith({}, { start }).startResearch(
      makeReq(researchBody),
      res as any,
    );

    expect(res.getStatus()).toBe(500);
  });
});

describe('AiChatController.getResearchJob', () => {
  it('returns 200 with the job view', async () => {
    const get = mock(() => ({
      jobId: 'job-1',
      status: 'running' as const,
      progress: [{ seq: 1, stage: 'plan', message: 'plano', createdAt: 1 }],
    }));
    const res = makeRes();

    await controllerWith({}, { get } as any).getResearchJob(
      makeReq({}, { jobId: 'job-1' }),
      res as any,
    );

    expect(res.getStatus()).toBe(200);
    expect((res.getPayload() as any).data.status).toBe('running');
  });

  it('returns 404 for a job that does not exist', async () => {
    const get = mock(() => null);
    const res = makeRes();

    await controllerWith({}, { get } as any).getResearchJob(
      makeReq({}, { jobId: 'nope' }),
      res as any,
    );

    expect(res.getStatus()).toBe(404);
  });

  it('returns 500 when the lookup throws', async () => {
    const get = mock(() => {
      throw new Error('db down');
    });
    const res = makeRes();

    await controllerWith({}, { get } as any).getResearchJob(
      makeReq({}, { jobId: 'job-1' }),
      res as any,
    );

    expect(res.getStatus()).toBe(500);
  });
});
