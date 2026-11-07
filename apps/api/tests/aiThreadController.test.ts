import { describe, expect, it, mock } from 'bun:test';
import { AiChatController } from 'modules/ai-chat/ai-chat.controller';
import { AiChatService } from 'modules/ai-chat/ai-chat.service';
import { ResearchOrchestrator } from 'modules/ai-chat/research/research-orchestrator.service';
import { AiThreadService } from 'modules/ai-chat/thread/ai-thread.service';
import { AiTraceQuery } from 'modules/ai-chat/trace/ai-trace-query';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';

const askBody = {
  threadId: 't1',
  guildId: 'g1',
  channelId: 'c1',
  userId: 'u1',
  content: 'quanto é 2+2?',
};

const researchBody = {
  threadId: 't1',
  guildId: 'g1',
  channelId: 'c1',
  userId: 'u1',
  query: 'estado da arte de X',
  idempotencyKey: 'interaction-1',
};

async function withController(
  threadService: Record<string, unknown>,
  research: Record<string, unknown>,
  run: (
    server: Awaited<ReturnType<typeof startNestControllerServer>>,
  ) => Promise<void>,
) {
  const server = await startNestControllerServer({
    controllers: [AiChatController],
    providers: [
      { provide: AiChatService, useValue: {} },
      { provide: AiTraceQuery, useValue: {} },
      { provide: AiThreadService, useValue: threadService },
      { provide: ResearchOrchestrator, useValue: research },
    ],
  });
  try {
    await run(server);
  } finally {
    await server.close();
  }
}

describe('AiChatController.askInThread', () => {
  it('returns 200 with the service result as data', async () => {
    const ask = mock(async () => ({
      status: 'ok' as const,
      reply: '4',
      format: 'text' as const,
    }));
    await withController({ ask }, {}, async (server) => {
      const response = await requestController(server, '/ai-chat/thread/ask', {
        method: 'POST',
        body: askBody,
      });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: { status: 'ok', reply: '4', format: 'text' },
      });
    });
  });

  it('forwards the whole thread payload to the service', async () => {
    const ask = mock(async () => ({ status: 'ok' as const, reply: 'x' }));
    await withController({ ask }, {}, async (server) => {
      await requestController(server, '/ai-chat/thread/ask', {
        method: 'POST',
        body: { ...askBody, mode: 'research' },
      });
      expect(ask).toHaveBeenCalledWith({
        threadId: 't1',
        guildId: 'g1',
        channelId: 'c1',
        userId: 'u1',
        content: 'quanto é 2+2?',
        mode: 'research',
      });
    });
  });

  it('passes a rate_limited result through as 200, not as an error', async () => {
    const ask = mock(async () => ({ status: 'rate_limited' as const }));
    await withController({ ask }, {}, async (server) => {
      const response = await requestController(server, '/ai-chat/thread/ask', {
        method: 'POST',
        body: askBody,
      });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: { status: 'rate_limited' } });
    });
  });

  it('returns the route error response when the service throws', async () => {
    const ask = mock(async () => {
      throw new Error('boom interno');
    });
    await withController({ ask }, {}, async (server) => {
      const response = await requestController(server, '/ai-chat/thread/ask', {
        method: 'POST',
        body: askBody,
      });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Unknown Error' });
      expect(JSON.stringify(response.body)).not.toContain('boom interno');
    });
  });
});

describe('AiChatController.startResearch', () => {
  it('returns 202 with the job id when the job is accepted', async () => {
    const start = mock(async () => ({
      status: 'accepted' as const,
      jobId: 'job-1',
      created: true,
    }));
    await withController({}, { start }, async (server) => {
      const response = await requestController(server, '/ai-chat/research', {
        method: 'POST',
        body: researchBody,
      });
      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        data: { status: 'accepted', jobId: 'job-1', created: true },
      });
    });
  });

  it('reports created false for a retried idempotency key', async () => {
    const start = mock(async () => ({
      status: 'accepted' as const,
      jobId: 'job-1',
      created: false,
    }));
    await withController({}, { start }, async (server) => {
      const response = await requestController(server, '/ai-chat/research', {
        method: 'POST',
        body: researchBody,
      });
      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        data: { status: 'accepted', jobId: 'job-1', created: false },
      });
    });
  });

  it('returns 200 rate_limited when the daily limit is spent', async () => {
    const start = mock(async () => ({ status: 'rate_limited' as const }));
    await withController({}, { start }, async (server) => {
      const response = await requestController(server, '/ai-chat/research', {
        method: 'POST',
        body: researchBody,
      });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: { status: 'rate_limited' } });
    });
  });

  it('returns 200 rejected with the roast when the query is an injection attempt', async () => {
    const start = mock(async () => ({
      status: 'rejected' as const,
      reply: 'Trouxa, eu sou filho do Rei :P',
    }));
    await withController({}, { start }, async (server) => {
      const response = await requestController(server, '/ai-chat/research', {
        method: 'POST',
        body: researchBody,
      });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: { status: 'rejected', reply: 'Trouxa, eu sou filho do Rei :P' },
      });
    });
  });

  it('returns the route error response when the orchestrator throws', async () => {
    const start = mock(async () => {
      throw new Error('db down');
    });
    await withController({}, { start }, async (server) => {
      const response = await requestController(server, '/ai-chat/research', {
        method: 'POST',
        body: researchBody,
      });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Unknown Error' });
    });
  });
});

describe('AiChatController.getResearchJob', () => {
  it('returns 200 with the job view', async () => {
    const get = mock(() => ({
      jobId: 'job-1',
      status: 'running' as const,
      progress: [{ seq: 1, stage: 'plan', message: 'plano', createdAt: 1 }],
    }));
    await withController({}, { get }, async (server) => {
      const response = await requestController(
        server,
        '/ai-chat/research/job-1',
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: {
          jobId: 'job-1',
          status: 'running',
          progress: [{ seq: 1, stage: 'plan', message: 'plano', createdAt: 1 }],
        },
      });
    });
  });

  it('returns 404 for a job that does not exist', async () => {
    const get = mock(() => null);
    await withController({}, { get }, async (server) => {
      const response = await requestController(
        server,
        '/ai-chat/research/nope',
      );
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'Job not found' });
    });
  });

  it('returns the route error response when the lookup throws', async () => {
    const get = mock(() => {
      throw new Error('db down');
    });
    await withController({}, { get }, async (server) => {
      const response = await requestController(
        server,
        '/ai-chat/research/job-1',
      );
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Unknown Error' });
    });
  });
});
