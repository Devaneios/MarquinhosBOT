import type { DailyQuotaService } from 'modules/ai-chat/daily-quota.service';
import type { DockerClient } from 'modules/ai-chat/sandbox/docker-client';
import type { AgentTool } from 'modules/ai-chat/tools/types';
import type OpenAI from 'openai';

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');
export const OPENAI_RESPONSES_CLIENT = Symbol('OPENAI_RESPONSES_CLIENT');
export const OPENAI_MODEL = Symbol('OPENAI_MODEL');
export const OPENAI_REASONING_EFFORT = Symbol('OPENAI_REASONING_EFFORT');
export const DOCKER_CLIENT = Symbol('DOCKER_CLIENT');
export const DOCKER_DRIVER = Symbol('DOCKER_DRIVER');
export const SPAWN_EXEC = Symbol('SPAWN_EXEC');
export const KNOWLEDGE_BASE_FETCH = Symbol('KNOWLEDGE_BASE_FETCH');
export const SEARXNG_FETCH = Symbol('SEARXNG_FETCH');
export const PAGE_FETCHER = Symbol('PAGE_FETCHER');
export const AI_NOW = Symbol('AI_NOW');
export const AI_AGENT_TOOLS = Symbol('AI_AGENT_TOOLS');
export const SANDBOX_IMAGE = Symbol('SANDBOX_IMAGE');
export const SANDBOX_MIRROR_PATH = Symbol('SANDBOX_MIRROR_PATH');
export const AI_AGENT_DAILY_QUOTA_SERVICE = Symbol(
  'AI_AGENT_DAILY_QUOTA_SERVICE',
);
export const AI_RESEARCH_DAILY_QUOTA_SERVICE = Symbol(
  'AI_RESEARCH_DAILY_QUOTA_SERVICE',
);

export type OpenAiSdkClient = OpenAI;
export type DockerClientProvider = DockerClient;
export type AgentTools = AgentTool[];
export type AiNow = () => number;
export type PageFetcherProvider =
  import('modules/ai-chat/web/fetch-page').PageFetcher;
export type QuotaProvider = DailyQuotaService;
