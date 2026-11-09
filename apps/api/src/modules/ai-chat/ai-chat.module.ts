import type { Db } from '@marquinhos/database/client';
import { Module } from '@nestjs/common';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { AppConfig } from 'config/app.config';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { DB } from 'database/database.tokens';
import Docker from 'dockerode';
import { AgentToolLoopService } from 'modules/ai-chat/agent/agent-tool-loop.service';
import {
  THREAD_DEADLINE_MS,
  THREAD_MAX_ITERATIONS,
  THREAD_MAX_TOOL_CALLS,
  ThreadAgentLoop,
} from 'modules/ai-chat/agent/thread-agent-loop';
import { ToolDispatcher } from 'modules/ai-chat/agent/tool-dispatcher';
import { AiChatController } from 'modules/ai-chat/ai-chat.controller';
import { AiChatService } from 'modules/ai-chat/ai-chat.service';
import {
  AI_AGENT_DAILY_QUOTA_SERVICE,
  AI_AGENT_TOOLS,
  AI_NOW,
  AI_RESEARCH_DAILY_QUOTA_SERVICE,
  DOCKER_CLIENT,
  DOCKER_DRIVER,
  PAGE_FETCHER,
  SANDBOX_IMAGE,
  SANDBOX_MIRROR_PATH,
  SPAWN_EXEC,
} from 'modules/ai-chat/ai-chat.tokens';
import {
  AGENT_DAILY_QUOTA,
  DailyQuotaService,
  RESEARCH_DAILY_QUOTA,
} from 'modules/ai-chat/daily-quota.service';
import { GuardrailService } from 'modules/ai-chat/guardrail.service';
import { KnowledgeBaseClient } from 'modules/ai-chat/knowledge-base.client';
import { LlmModule } from 'modules/ai-chat/llm/llm.module';
import { ResponsesClient } from 'modules/ai-chat/llm/responses.client';
import { RateLimitService } from 'modules/ai-chat/rate-limit.service';
import {
  DeepResearchService,
  MAX_FETCHES,
  MAX_ROUNDS,
  MAX_SEARCHES,
  RESEARCH_DEADLINE_MS,
} from 'modules/ai-chat/research/deep-research.service';
import { ResearchJobStore } from 'modules/ai-chat/research/research-job.store';
import { ResearchOrchestrator } from 'modules/ai-chat/research/research-orchestrator.service';
import {
  DockerodeSandboxClient,
  type SpawnExec,
} from 'modules/ai-chat/sandbox/dockerode-sandbox.client';
import { SandboxManager } from 'modules/ai-chat/sandbox/sandbox-manager.service';
import { AiThreadService } from 'modules/ai-chat/thread/ai-thread.service';
import { ThreadSessionStore } from 'modules/ai-chat/thread/thread-session.store';
import { createAgentTools } from 'modules/ai-chat/tools/registry';
import { createSearchWebTool } from 'modules/ai-chat/tools/search-web';
import type { AgentTool } from 'modules/ai-chat/tools/types';
import { AiTraceQuery } from 'modules/ai-chat/trace/ai-trace-query';
import { AiTraceRecorder } from 'modules/ai-chat/trace/ai-trace-recorder.service';
import type { PageFetcher } from 'modules/ai-chat/web/fetch-page';
import { createPageFetcher } from 'modules/ai-chat/web/fetch-page';
import { SearxngClient } from 'modules/ai-chat/web/searxng.client';

const DEFAULT_DOCKER_SOCKET = '/var/run/docker.sock';
const spawnExec: SpawnExec = (argv, options) => Bun.spawn(argv, options);

@Module({
  imports: [ConfigModule, DatabaseModule, LlmModule],
  controllers: [AiChatController],
  providers: [
    BotAuthGuard,
    GuardrailService,
    RateLimitService,
    AiTraceQuery,
    AiTraceRecorder,
    ResearchJobStore,
    { provide: AI_NOW, useValue: Date.now },
    {
      provide: AI_AGENT_DAILY_QUOTA_SERVICE,
      useFactory: (db: Db) => new DailyQuotaService(AGENT_DAILY_QUOTA, db),
      inject: [DB],
    },
    {
      provide: AI_RESEARCH_DAILY_QUOTA_SERVICE,
      useFactory: (db: Db) => new DailyQuotaService(RESEARCH_DAILY_QUOTA, db),
      inject: [DB],
    },
    {
      provide: ThreadSessionStore,
      useFactory: (db: Db, config: AppConfig) =>
        new ThreadSessionStore(db, config.aiThreadTokenBudget),
      inject: [DB, AppConfig],
    },
    {
      provide: SANDBOX_IMAGE,
      useFactory: (config: AppConfig) => config.sandboxImage,
      inject: [AppConfig],
    },
    {
      provide: SANDBOX_MIRROR_PATH,
      useFactory: (config: AppConfig) => config.sandboxMirrorPath,
      inject: [AppConfig],
    },
    {
      provide: DOCKER_DRIVER,
      useFactory: () => new Docker({ socketPath: DEFAULT_DOCKER_SOCKET }),
    },
    {
      provide: SPAWN_EXEC,
      useValue: spawnExec,
    },
    DockerodeSandboxClient,
    { provide: DOCKER_CLIENT, useExisting: DockerodeSandboxClient },
    SandboxManager,
    {
      provide: KnowledgeBaseClient,
      useFactory: (config: AppConfig) =>
        new KnowledgeBaseClient(fetch, {
          knowledgeBaseUrl: config.knowledgeBaseUrl,
          knowledgeBaseApiKey: config.knowledgeBaseApiKey,
        }),
      inject: [AppConfig],
    },
    {
      provide: SearxngClient,
      useFactory: (config: AppConfig) =>
        new SearxngClient({ baseUrl: config.searxngUrl }),
      inject: [AppConfig],
    },
    {
      provide: PAGE_FETCHER,
      useFactory: () => createPageFetcher(),
    },
    {
      provide: AI_AGENT_TOOLS,
      useFactory: (searxng: SearxngClient) =>
        createAgentTools(
          createSearchWebTool({
            search: (query, options) => searxng.search(query, options),
          }),
        ),
      inject: [SearxngClient],
    },
    ToolDispatcher,
    AgentToolLoopService,
    {
      provide: ThreadAgentLoop,
      useFactory: (
        dispatcher: ToolDispatcher,
        responses: ResponsesClient,
        now: () => number,
        tools: AgentTool[],
      ) =>
        new ThreadAgentLoop(
          dispatcher,
          responses,
          now,
          THREAD_MAX_ITERATIONS,
          THREAD_MAX_TOOL_CALLS,
          THREAD_DEADLINE_MS,
          tools,
        ),
      inject: [ToolDispatcher, ResponsesClient, AI_NOW, AI_AGENT_TOOLS],
    },
    {
      provide: DeepResearchService,
      useFactory: (
        responses: ResponsesClient,
        searxng: SearxngClient,
        fetchPage: PageFetcher,
        now: () => number,
        config: AppConfig,
      ) =>
        new DeepResearchService(responses, searxng, fetchPage, now, {
          maxRounds: config.aiResearchMaxRounds || MAX_ROUNDS,
          maxSearches: config.aiResearchMaxSearches || MAX_SEARCHES,
          maxFetches: config.aiResearchMaxFetches || MAX_FETCHES,
          deadlineMs: config.aiResearchDeadlineMs || RESEARCH_DEADLINE_MS,
        }),
      inject: [ResponsesClient, SearxngClient, PAGE_FETCHER, AI_NOW, AppConfig],
    },
    AiChatService,
    AiThreadService,
    ResearchOrchestrator,
  ],
  exports: [
    AgentToolLoopService,
    AiChatService,
    AiTraceQuery,
    AiTraceRecorder,
    AI_AGENT_DAILY_QUOTA_SERVICE,
    AI_RESEARCH_DAILY_QUOTA_SERVICE,
    RateLimitService,
    ResearchOrchestrator,
    SandboxManager,
  ],
})
export class AiChatModule {}
