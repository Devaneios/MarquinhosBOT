import { z } from 'zod';
import { defineContract, envelope } from '../contract';

const requiredString = z.string().min(1);

export const aiResponseCategorySchema = z.enum([
  'general_question',
  'code_technical_question',
  'trick_riddle',
  'bot_help_info',
  'casual_chat',
  'user_roast_provocation',
  'praise_thanks',
  'opinion_reference',
  'follow_up_on_bot',
  'off_topic_unclear',
]);
export type AiResponseCategory = z.output<typeof aiResponseCategorySchema>;

export const aiChatCategorySchema = z.enum([
  ...aiResponseCategorySchema.options,
  'guardrail_roast',
  'agent_task',
]);
export type AiChatCategory = z.output<typeof aiChatCategorySchema>;

export const aiChatResultSchema = z.object({
  status: z.enum(['ok', 'rate_limited', 'error']),
  category: aiChatCategorySchema.optional(),
  reply: z.string().optional(),
  format: z.enum(['embed', 'text']).optional(),
  embedTitle: z.string().optional(),
  traceId: z.string().optional(),
});
export type AiChatResult = z.output<typeof aiChatResultSchema>;

export const researchSourceSchema = z.object({
  index: z.number(),
  url: z.string(),
  title: z.string(),
  publishedDate: z.string().optional(),
});
export type ResearchSource = z.output<typeof researchSourceSchema>;

export const researchStatsSchema = z.object({
  rounds: z.number(),
  searches: z.number(),
  fetched: z.number(),
  relevantSources: z.number(),
  maxDepth: z.number(),
  durationMs: z.number(),
  truncatedByBudget: z.boolean().optional(),
});
export type ResearchStats = z.output<typeof researchStatsSchema>;

export const researchProgressEventSchema = z.object({
  seq: z.number(),
  stage: z.string(),
  message: z.string(),
  createdAt: z.number(),
});
export type ResearchProgressEvent = z.output<
  typeof researchProgressEventSchema
>;

export const researchJobStatusSchema = z.enum([
  'queued',
  'running',
  'done',
  'error',
]);

export const researchJobViewSchema = z.object({
  jobId: z.string(),
  threadId: z.string(),
  userId: z.string(),
  guildId: z.string(),
  channelId: z.string(),
  query: z.string(),
  status: researchJobStatusSchema,
  report: z.string().optional(),
  sources: z.array(researchSourceSchema).optional(),
  stats: researchStatsSchema.optional(),
  error: z.string().optional(),
  createdAt: z.number(),
  finishedAt: z.number().optional(),
  progress: z.array(researchProgressEventSchema),
});
export type ResearchJobView = z.output<typeof researchJobViewSchema>;

export const researchStartResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('accepted'),
    jobId: z.string(),
    created: z.boolean(),
  }),
  z.object({ status: z.literal('rate_limited') }),
  z.object({ status: z.literal('rejected'), reply: z.string() }),
]);
export type ResearchStartResult = z.output<typeof researchStartResultSchema>;

const traceRowSchema = z.object({
  trace_id: z.string(),
  user_id: z.string(),
  guild_id: z.string(),
  channel_id: z.string(),
  content: z.string(),
  main_category: z.string().nullable(),
  category: z.string().nullable(),
  status: z.string().nullable(),
  reply: z.string().nullable(),
  format: z.string().nullable(),
  error: z.string().nullable(),
  iterations: z.number(),
  tool_calls_used: z.number(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  duration_ms: z.number().nullable(),
  created_at: z.number(),
});

const traceEventRowSchema = z.object({
  seq: z.number(),
  type: z.string(),
  phase: z.string().nullable(),
  name: z.string().nullable(),
  input: z.string().nullable(),
  output: z.string().nullable(),
  status: z.string().nullable(),
  exit_code: z.number().nullable(),
  duration_ms: z.number().nullable(),
  created_at: z.number(),
});

const chatMessageSchema = z.object({ author: z.string(), content: z.string() });

export const respond = defineContract({
  method: 'POST',
  path: '/api/ai-chat/respond',
  body: z.object({
    userId: requiredString,
    guildId: requiredString,
    channelId: requiredString,
    content: requiredString,
    recentMessages: z.array(chatMessageSchema).max(20),
    repliedMessage: chatMessageSchema.optional(),
  }),
  response: envelope(aiChatResultSchema),
});

export const askInThread = defineContract({
  method: 'POST',
  path: '/api/ai-chat/thread/ask',
  body: z.object({
    threadId: requiredString,
    guildId: requiredString,
    channelId: requiredString,
    userId: requiredString,
    content: z.string().min(1).max(4000),
    mode: z.enum(['ask', 'research']).optional(),
  }),
  response: envelope(aiChatResultSchema),
});

export const startResearch = defineContract({
  method: 'POST',
  path: '/api/ai-chat/research',
  body: z.object({
    threadId: requiredString,
    guildId: requiredString,
    channelId: requiredString,
    userId: requiredString,
    query: z.string().min(3).max(1000),
    idempotencyKey: requiredString,
  }),
  response: envelope(researchStartResultSchema),
});

export const getResearchJob = defineContract({
  method: 'GET',
  path: '/api/ai-chat/research/:jobId',
  params: z.object({ jobId: requiredString }),
  response: envelope(researchJobViewSchema),
});

export const listTraces = defineContract({
  method: 'GET',
  path: '/api/ai-chat/traces',
  query: z.object({
    limit: z.coerce.number().optional(),
    userId: z.string().optional(),
    status: z.string().optional(),
    category: z.string().optional(),
  }),
  response: envelope(z.array(traceRowSchema)),
});

export const getTrace = defineContract({
  method: 'GET',
  path: '/api/ai-chat/traces/:traceId',
  params: z.object({ traceId: requiredString }),
  response: envelope(
    z.object({ trace: traceRowSchema, events: z.array(traceEventRowSchema) }),
  ),
});
