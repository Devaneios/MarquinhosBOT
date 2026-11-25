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

const researchAcceptedSchema = z.object({
  status: z.literal('accepted'),
  jobId: z.string(),
  created: z.boolean(),
});
const researchRateLimitedSchema = z.object({
  status: z.literal('rate_limited'),
});
const researchRejectedSchema = z.object({
  status: z.literal('rejected'),
  reply: z.string(),
});

export const researchStartResultSchema = z.discriminatedUnion('status', [
  researchAcceptedSchema,
  researchRateLimitedSchema,
  researchRejectedSchema,
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

const botSecurity = ['botBearer'] as const;
const aiTags = ['AI chat'] as const;
const discordContextExample = {
  userId: '123456789012345678',
  guildId: '234567890123456789',
  channelId: '345678901234567890',
};

const threadExample = {
  ...discordContextExample,
  threadId: '456789012345678901',
};
const researchJobExampleId = 'research-example-001';
const traceExampleId = 'trace-example-001';
const aiErrors = {
  400: {
    description: 'The request did not satisfy the operation input schema.',
    example: { message: 'Validation failed' },
  },
  401: {
    description:
      'The bot credential was absent or did not match the configured key.',
    example: { message: 'Token not authorized' },
  },
  500: {
    description:
      'The operation failed unexpectedly or the server has no bot key configured.',
    example: { message: 'Unknown Error' },
  },
};

const traceExample = {
  trace_id: traceExampleId,
  user_id: discordContextExample.userId,
  guild_id: discordContextExample.guildId,
  channel_id: discordContextExample.channelId,
  content: 'Como encontro meus palpites de hoje?',
  main_category: 'bot_help_info',
  category: 'bot_help_info',
  status: 'ok',
  reply: 'Abra /termo sem preencher o palpite para ver a rodada.',
  format: 'text',
  error: null,
  iterations: 1,
  tool_calls_used: 0,
  prompt_tokens: 340,
  completion_tokens: 32,
  duration_ms: 780,
  created_at: 1795629600000,
};

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
  docs: {
    tags: aiTags,
    security: botSecurity,
    description:
      'Generate a Discord reply using a new message, up to 20 recent messages, and the message it replied to when available. Rate-limit outcomes are reported in the response body.',
    examples: {
      body: {
        ...discordContextExample,
        content: traceExample.content,
        recentMessages: [
          { author: 'Bia', content: 'Já joguei Terminhos hoje.' },
        ],
      },
    },
    success: {
      200: {
        description:
          'Reply, rate-limit outcome, or handled reply-generation failure.',
        example: {
          data: {
            status: 'ok',
            category: 'bot_help_info',
            reply: traceExample.reply,
            format: 'text',
            traceId: traceExampleId,
          },
        },
      },
    },
    errors: aiErrors,
  },
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
  docs: {
    tags: aiTags,
    security: botSecurity,
    description:
      'Answer a question using the context associated with a Discord thread. The optional mode lets the bot select the ask or research context.',
    examples: {
      body: {
        ...threadExample,
        content: 'Como recupero a rodada de hoje?',
        mode: 'ask',
      },
    },
    success: {
      200: {
        description:
          'Thread reply or a handled rate-limit or generation failure.',
        example: {
          data: {
            status: 'ok',
            reply: 'Use /termo ou reabra a Activity para carregar a rodada.',
          },
        },
      },
    },
    errors: aiErrors,
  },
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
  docs: {
    tags: aiTags,
    security: botSecurity,
    description:
      'Queue research for a Discord thread and return the job ID to poll. Repeating a start with the same idempotency key can return the existing job.',
    examples: {
      body: {
        ...threadExample,
        query: 'Como funcionam as marés?',
        idempotencyKey: 'discord-interaction-567890123456789012',
      },
    },
    success: {
      200: {
        description:
          'Research was declined or the caller reached the research limit.',
        schema: envelope(
          z.discriminatedUnion('status', [
            researchRateLimitedSchema,
            researchRejectedSchema,
          ]),
        ),
        example: { data: { status: 'rate_limited' } },
      },
      202: {
        description:
          'Job accepted. The created flag indicates whether this request started a new job.',
        schema: envelope(researchAcceptedSchema),
        example: {
          data: {
            status: 'accepted',
            jobId: researchJobExampleId,
            created: true,
          },
        },
      },
    },
    errors: aiErrors,
  },
});

export const getResearchJob = defineContract({
  method: 'GET',
  path: '/api/ai-chat/research/:jobId',
  params: z.object({ jobId: requiredString }),
  response: envelope(researchJobViewSchema),
  docs: {
    tags: aiTags,
    security: botSecurity,
    description:
      'Read a research job and its ordered progress events. Completed jobs can include the report, sources, and execution statistics.',
    examples: { params: { jobId: researchJobExampleId } },
    success: {
      200: {
        description:
          'Current job snapshot for the bot to render in the Discord thread.',
        example: {
          data: {
            ...threadExample,
            jobId: researchJobExampleId,
            query: 'Como funcionam as marés?',
            status: 'running',
            createdAt: 1795629600000,
            progress: [],
          },
        },
      },
    },
    errors: {
      ...aiErrors,
      404: {
        description: 'No research job exists for the supplied ID.',
        example: { message: 'Job not found' },
      },
    },
  },
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
  docs: {
    tags: aiTags,
    security: botSecurity,
    description:
      'List stored AI execution traces, with optional user, status, and category filters. The response includes prompts and replies and is restricted to the bot.',
    examples: {
      query: { limit: 10, userId: discordContextExample.userId, status: 'ok' },
    },
    success: {
      200: {
        description: 'Matching trace summaries for operational inspection.',
        example: { data: [traceExample] },
      },
    },
    errors: aiErrors,
  },
});

export const getTrace = defineContract({
  method: 'GET',
  path: '/api/ai-chat/traces/:traceId',
  params: z.object({ traceId: requiredString }),
  response: envelope(
    z.object({ trace: traceRowSchema, events: z.array(traceEventRowSchema) }),
  ),
  docs: {
    tags: aiTags,
    security: botSecurity,
    description:
      'Read one stored trace with its execution events to inspect the sequence of model and tool activity.',
    examples: { params: { traceId: traceExampleId } },
    success: {
      200: {
        description: 'Trace summary and its event timeline.',
        example: { data: { trace: traceExample, events: [] } },
      },
    },
    errors: {
      ...aiErrors,
      404: {
        description: 'No trace exists for the supplied ID.',
        example: { message: 'Trace not found' },
      },
    },
  },
});
