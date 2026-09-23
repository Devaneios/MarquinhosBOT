import * as contract from '@marquinhos/contracts/http/routes/aiChat';
import type { Request, Response } from 'express';
import { AiChatService } from 'services/aiChat/AiChatService';
import { AiTraceQuery } from 'services/aiChat/AiTraceQuery';
import { ResearchOrchestrator } from 'services/aiChat/research/ResearchOrchestrator';
import { AiThreadService } from 'services/aiChat/thread/AiThreadService';
import { parseRequest, sendContract } from 'utils/contract';
import { logger } from 'utils/logger';

class AiChatController {
  private service: AiChatService;
  private traceQuery: AiTraceQuery;
  private threadService: AiThreadService;
  private research: ResearchOrchestrator;

  constructor(
    service: AiChatService = new AiChatService(),
    traceQuery: AiTraceQuery = new AiTraceQuery(),
    threadService: AiThreadService = new AiThreadService(),
    research: ResearchOrchestrator = new ResearchOrchestrator(),
  ) {
    this.service = service;
    this.traceQuery = traceQuery;
    this.threadService = threadService;
    this.research = research;
  }

  async askInThread(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.askInThread, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { threadId, guildId, channelId, userId, content, mode } =
        input.body;

      const result = await this.threadService.ask({
        threadId,
        guildId,
        channelId,
        userId,
        content,
        mode,
      });

      return sendContract(res, contract.askInThread, { data: result });
    } catch (error) {
      logger.error('ai.controller.thread_ask_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async startResearch(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.startResearch, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { threadId, guildId, channelId, userId, query, idempotencyKey } =
        input.body;

      const outcome = this.research.start({
        threadId,
        guildId,
        channelId,
        userId,
        query,
        idempotencyKey,
      });

      if (outcome.status === 'rate_limited') {
        return sendContract(res, contract.startResearch, {
          data: { status: 'rate_limited' },
        });
      }
      if (outcome.status === 'rejected') {
        return sendContract(res, contract.startResearch, {
          data: { status: 'rejected', reply: outcome.reply },
        });
      }

      return sendContract(
        res,
        contract.startResearch,
        {
          data: {
            status: 'accepted',
            jobId: outcome.jobId,
            created: outcome.created,
          },
        },
        202,
      );
    } catch (error) {
      logger.error('ai.controller.research_start_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async getResearchJob(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.getResearchJob, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const job = this.research.get(input.params.jobId);
      if (!job) return res.status(404).json({ message: 'Job not found' });
      return sendContract(res, contract.getResearchJob, { data: job });
    } catch (error) {
      logger.error('ai.controller.research_get_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async respond(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.respond, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const {
        userId,
        guildId,
        channelId,
        content,
        recentMessages,
        repliedMessage,
      } = input.body;

      const result = await this.service.respond({
        userId,
        guildId,
        channelId,
        content,
        recentMessages,
        repliedMessage,
      });

      return sendContract(res, contract.respond, { data: result });
    } catch (error) {
      logger.error('ai.controller.respond_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async listTraces(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.listTraces, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }

      const traces = this.traceQuery.list(input.query);

      return sendContract(res, contract.listTraces, { data: traces });
    } catch (error) {
      logger.error('ai.controller.list_traces_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async getTrace(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.getTrace, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const trace = this.traceQuery.get(input.params.traceId);
      if (!trace) return res.status(404).json({ message: 'Trace not found' });
      return sendContract(res, contract.getTrace, { data: trace });
    } catch (error) {
      logger.error('ai.controller.get_trace_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default AiChatController;
