import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/aiChat';
import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Res,
} from '@nestjs/common';
import { BotAuth } from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import type { Response } from 'express';
import { AiChatService } from 'modules/ai-chat/ai-chat.service';
import { ResearchOrchestrator } from 'modules/ai-chat/research/research-orchestrator.service';
import { AiThreadService } from 'modules/ai-chat/thread/ai-thread.service';
import { AiTraceQuery } from 'modules/ai-chat/trace/ai-trace-query';

@Controller('ai-chat')
export class AiChatController {
  constructor(
    private readonly service: AiChatService,
    private readonly traceQuery: AiTraceQuery,
    private readonly threadService: AiThreadService,
    private readonly research: ResearchOrchestrator,
  ) {}

  @Post('respond')
  @HttpCode(200)
  @BotAuth()
  @OnRouteError({
    event: 'ai.controller.respond_failed',
    message: 'Unknown Error',
  })
  async respond(
    @ContractInput(contract.respond)
    input: ContractInputValue<typeof contract.respond>,
  ): Promise<ContractResponseInput<typeof contract.respond>> {
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
    return { data: result };
  }

  @Post('thread/ask')
  @HttpCode(200)
  @BotAuth()
  @OnRouteError({
    event: 'ai.controller.thread_ask_failed',
    message: 'Unknown Error',
  })
  async askInThread(
    @ContractInput(contract.askInThread)
    input: ContractInputValue<typeof contract.askInThread>,
  ): Promise<ContractResponseInput<typeof contract.askInThread>> {
    const { threadId, guildId, channelId, userId, content, mode } = input.body;
    const result = await this.threadService.ask({
      threadId,
      guildId,
      channelId,
      userId,
      content,
      mode,
    });
    return { data: result };
  }

  @Post('research')
  @HttpCode(200)
  @BotAuth()
  @OnRouteError({
    event: 'ai.controller.research_start_failed',
    message: 'Unknown Error',
  })
  async startResearch(
    @ContractInput(contract.startResearch)
    input: ContractInputValue<typeof contract.startResearch>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ContractResponseInput<typeof contract.startResearch>> {
    const { threadId, guildId, channelId, userId, query, idempotencyKey } =
      input.body;
    const outcome = await this.research.start({
      threadId,
      guildId,
      channelId,
      userId,
      query,
      idempotencyKey,
    });

    if (outcome.status === 'rate_limited') {
      return { data: { status: 'rate_limited' } };
    }
    if (outcome.status === 'rejected') {
      return { data: { status: 'rejected', reply: outcome.reply } };
    }

    response.status(202);
    return {
      data: {
        status: 'accepted',
        jobId: outcome.jobId,
        created: outcome.created,
      },
    };
  }

  @Get('research/:jobId')
  @BotAuth()
  @OnRouteError({
    event: 'ai.controller.research_get_failed',
    message: 'Unknown Error',
  })
  async getResearchJob(
    @ContractInput(contract.getResearchJob, 'Validation failed')
    input: ContractInputValue<typeof contract.getResearchJob>,
  ): Promise<ContractResponseInput<typeof contract.getResearchJob>> {
    const job = await this.research.get(input.params.jobId);
    if (!job) throw new NotFoundException('Job not found');
    return { data: job };
  }

  @Get('traces')
  @BotAuth()
  @OnRouteError({
    event: 'ai.controller.list_traces_failed',
    message: 'Unknown Error',
  })
  async listTraces(
    @ContractInput(contract.listTraces, 'Validation failed')
    input: ContractInputValue<typeof contract.listTraces>,
  ): Promise<ContractResponseInput<typeof contract.listTraces>> {
    return { data: await this.traceQuery.list(input.query) };
  }

  @Get('traces/:traceId')
  @BotAuth()
  @OnRouteError({
    event: 'ai.controller.get_trace_failed',
    message: 'Unknown Error',
  })
  async getTrace(
    @ContractInput(contract.getTrace, 'Validation failed')
    input: ContractInputValue<typeof contract.getTrace>,
  ): Promise<ContractResponseInput<typeof contract.getTrace>> {
    const trace = await this.traceQuery.get(input.params.traceId);
    if (!trace) throw new NotFoundException('Trace not found');
    return { data: trace };
  }
}
