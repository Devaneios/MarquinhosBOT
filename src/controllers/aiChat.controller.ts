import type { Request, Response } from 'express';
import { AiChatService } from 'services/aiChat/AiChatService';
import { AiTraceQuery } from 'services/aiChat/AiTraceQuery';
import { ResearchOrchestrator } from 'services/aiChat/research/ResearchOrchestrator';
import { AiThreadService } from 'services/aiChat/thread/AiThreadService';
import type { ThreadMode } from 'services/aiChat/thread/ThreadSessionStore';
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
      const { threadId, guildId, channelId, userId, content, mode } =
        req.body as {
          threadId: string;
          guildId: string;
          channelId: string;
          userId: string;
          content: string;
          mode?: ThreadMode;
        };

      const result = await this.threadService.ask({
        threadId,
        guildId,
        channelId,
        userId,
        content,
        mode,
      });

      return res.status(200).json({ data: result });
    } catch (error) {
      logger.error('ai.controller.thread_ask_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async startResearch(req: Request, res: Response) {
    try {
      const { threadId, guildId, channelId, userId, query, idempotencyKey } =
        req.body as {
          threadId: string;
          guildId: string;
          channelId: string;
          userId: string;
          query: string;
          idempotencyKey: string;
        };

      const outcome = this.research.start({
        threadId,
        guildId,
        channelId,
        userId,
        query,
        idempotencyKey,
      });

      if (outcome.status === 'rate_limited') {
        return res.status(200).json({ data: { status: 'rate_limited' } });
      }
      if (outcome.status === 'rejected') {
        return res
          .status(200)
          .json({ data: { status: 'rejected', reply: outcome.reply } });
      }

      return res.status(202).json({
        data: {
          status: 'accepted',
          jobId: outcome.jobId,
          created: outcome.created,
        },
      });
    } catch (error) {
      logger.error('ai.controller.research_start_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async getResearchJob(req: Request, res: Response) {
    try {
      const job = this.research.get(req.params.jobId as string);
      if (!job) return res.status(404).json({ message: 'Job not found' });
      return res.status(200).json({ data: job });
    } catch (error) {
      logger.error('ai.controller.research_get_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async respond(req: Request, res: Response) {
    try {
      const {
        userId,
        guildId,
        channelId,
        content,
        recentMessages,
        repliedMessage,
      } = req.body as {
        userId: string;
        guildId: string;
        channelId: string;
        content: string;
        recentMessages: { author: string; content: string }[];
        repliedMessage?: { author: string; content: string };
      };

      const result = await this.service.respond({
        userId,
        guildId,
        channelId,
        content,
        recentMessages,
        repliedMessage,
      });

      return res.status(200).json({ data: result });
    } catch (error) {
      logger.error('ai.controller.respond_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async listTraces(req: Request, res: Response) {
    try {
      const { limit, userId, status, category } = req.query as {
        limit?: string;
        userId?: string;
        status?: string;
        category?: string;
      };

      const traces = this.traceQuery.list({
        limit: limit ? Number(limit) : undefined,
        userId,
        status,
        category,
      });

      return res.status(200).json({ data: traces });
    } catch (error) {
      logger.error('ai.controller.list_traces_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async getTrace(req: Request, res: Response) {
    try {
      const trace = this.traceQuery.get(req.params.traceId as string);
      if (!trace) return res.status(404).json({ message: 'Trace not found' });
      return res.status(200).json({ data: trace });
    } catch (error) {
      logger.error('ai.controller.get_trace_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default AiChatController;
