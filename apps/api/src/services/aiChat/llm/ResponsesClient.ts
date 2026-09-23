import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import {
  NOOP_TRACE,
  type TraceContext,
  type TraceUsage,
} from 'services/aiChat/AiTraceRecorder';
import { summarizeMessages } from 'services/aiChat/promptRegistry';
import { logger } from 'utils/logger';
import { z, type ZodType } from 'zod';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_REASONING_EFFORT =
  process.env.OPENAI_REASONING_EFFORT || 'medium';

/**
 * An item in a Responses conversation. Deliberately loose: the whole point of
 * this client is that we persist and replay the API's own output items
 * verbatim — including `reasoning` items carrying `encrypted_content` — so
 * narrowing them here would only invite lossy conversions.
 */
export const conversationItemSchema = z.record(z.string(), z.unknown());

export type ConversationItem = z.infer<typeof conversationItemSchema>;

export interface FunctionToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ResponseFunctionCall {
  callId: string;
  name: string;
  arguments: string;
}

export interface ResponsesTraceOptions {
  trace?: TraceContext;
  phase?: string;
}

export interface ResponsesCreateOptions extends ResponsesTraceOptions {
  input: ConversationItem[];
  instructions?: string;
  tools?: FunctionToolSpec[];
  toolChoice?: 'auto' | 'none' | 'required';
  maxOutputTokens: number;
  reasoningEffort?: string;
}

export interface ResponsesStructuredOptions<T> extends ResponsesTraceOptions {
  input: ConversationItem[];
  instructions?: string;
  schema: ZodType<T>;
  schemaName: string;
  maxOutputTokens: number;
  reasoningEffort?: string;
}

export interface ResponsesResult {
  /** Raw output items, ready to be appended to a transcript and replayed. */
  items: ConversationItem[];
  text: string;
  functionCalls: ResponseFunctionCall[];
  reasoningSummaries: string[];
  usage?: TraceUsage;
}

const rawResponseSchema = z.object({
  output: z.unknown().optional(),
  output_text: z.unknown().optional(),
  status: z.unknown().optional(),
  incomplete_details: z
    .object({ reason: z.unknown().optional() })
    .optional()
    .catch(undefined),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
    })
    .optional()
    .catch(undefined),
});

type RawResponse = z.infer<typeof rawResponseSchema>;

function conversationItems(value: unknown): ConversationItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = conversationItemSchema.safeParse(entry);
    return item.success ? [item.data] : [];
  });
}

/**
 * The response stopped at `max_output_tokens`. Worth its own type because
 * reasoning tokens are billed against that same ceiling: a high-effort call can
 * spend the entire budget thinking and return no text at all, which is not a
 * malformed answer but a budget that was too small.
 */
export class ResponseTruncatedError extends Error {}

function truncationReason(response: RawResponse): string | null {
  if (response.status !== 'incomplete') return null;
  const reason = response.incomplete_details?.reason;
  return typeof reason === 'string' ? reason : 'unknown';
}

function outputItems(response: RawResponse): ConversationItem[] {
  return conversationItems(response.output);
}

function collectText(response: RawResponse, items: ConversationItem[]): string {
  if (typeof response.output_text === 'string' && response.output_text) {
    return response.output_text;
  }
  return items
    .filter((item) => item.type === 'message')
    .flatMap((item) => conversationItems(item.content))
    .filter((part) => part.type === 'output_text')
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
}

/** Structured outputs answer a refusal in place of the message, never as text. */
function collectRefusal(items: ConversationItem[]): string | null {
  const refusal = items
    .filter((item) => item.type === 'message')
    .flatMap((item) => conversationItems(item.content))
    .find((part) => part.type === 'refusal');
  if (!refusal) return null;
  return typeof refusal.refusal === 'string' ? refusal.refusal : 'sem motivo';
}

function collectFunctionCalls(
  items: ConversationItem[],
): ResponseFunctionCall[] {
  return items
    .filter((item) => item.type === 'function_call')
    .map((item) => ({
      callId: String(item.call_id ?? item.id ?? ''),
      name: String(item.name ?? ''),
      arguments: typeof item.arguments === 'string' ? item.arguments : '{}',
    }));
}

function collectReasoningSummaries(items: ConversationItem[]): string[] {
  return items
    .filter((item) => item.type === 'reasoning')
    .flatMap((item) => conversationItems(item.summary))
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .filter((text) => text.length > 0);
}

export class ResponsesClient {
  constructor(
    private client: OpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    }),
  ) {}

  async create(options: ResponsesCreateOptions): Promise<ResponsesResult> {
    const params: Record<string, unknown> = {
      model: OPENAI_MODEL,
      input: options.input,
      max_output_tokens: options.maxOutputTokens,
      // We keep the transcript ourselves, so OpenAI must not retain state.
      // Asking for the encrypted reasoning back is what makes replaying the
      // model's own reasoning on later turns possible at all.
      store: false,
      include: ['reasoning.encrypted_content'],
      reasoning: {
        effort: options.reasoningEffort ?? DEFAULT_REASONING_EFFORT,
        summary: 'auto',
        context: 'all_turns',
      },
    };

    if (options.instructions) params.instructions = options.instructions;
    if (options.tools?.length) {
      params.tools = options.tools.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: false,
      }));
      params.tool_choice = options.toolChoice ?? 'auto';
    }

    return this.traced(options, options.input, async () => {
      const response = rawResponseSchema.parse(
        await this.client.responses.create(params as never),
      );

      const items = outputItems(response);
      if (items.length === 0) {
        throw new Error('OpenAI Responses returned no output items');
      }

      const truncated = truncationReason(response);
      if (truncated) {
        // Free-text callers can still use a cut-short answer, so this is a
        // warning rather than a failure — but it must not pass unnoticed.
        logger.warn('ai.responses.truncated', {
          phase: options.phase ?? 'unknown',
          reason: truncated,
          maxOutputTokens: options.maxOutputTokens,
        });
      }

      const usage = response.usage && {
        promptTokens: response.usage.input_tokens ?? 0,
        completionTokens: response.usage.output_tokens ?? 0,
      };

      const value: ResponsesResult = {
        items,
        text: collectText(response, items),
        functionCalls: collectFunctionCalls(items),
        reasoningSummaries: collectReasoningSummaries(items),
        ...(usage ? { usage } : {}),
      };
      return { value, output: items, usage };
    });
  }

  async structured<T>(options: ResponsesStructuredOptions<T>): Promise<T> {
    try {
      return await this.structuredAttempt(options, options.maxOutputTokens);
    } catch (error) {
      if (!(error instanceof ResponseTruncatedError)) throw error;
      // One retry with twice the ceiling: the first attempt proved the budget
      // was too tight for this call's reasoning, and failing the whole job over
      // a cap is worse than paying for a second try.
      logger.warn('ai.responses.retrying_truncated', {
        phase: options.phase ?? 'unknown',
        schemaName: options.schemaName,
        maxOutputTokens: options.maxOutputTokens,
      });
      return this.structuredAttempt(options, options.maxOutputTokens * 2);
    }
  }

  private async structuredAttempt<T>(
    options: ResponsesStructuredOptions<T>,
    maxOutputTokens: number,
  ): Promise<T> {
    const params: Record<string, unknown> = {
      model: OPENAI_MODEL,
      input: options.input,
      max_output_tokens: maxOutputTokens,
      store: false,
      reasoning: {
        effort: options.reasoningEffort ?? DEFAULT_REASONING_EFFORT,
      },
      text: { format: zodTextFormat(options.schema, options.schemaName) },
    };
    if (options.instructions) params.instructions = options.instructions;

    return this.traced(options, options.input, async () => {
      const response = rawResponseSchema.parse(
        await this.client.responses.create(params as never),
      );

      const truncated = truncationReason(response);
      if (truncated) {
        throw new ResponseTruncatedError(
          `OpenAI Responses truncou a saída do schema "${options.schemaName}" (${truncated}) com max_output_tokens=${maxOutputTokens}`,
        );
      }

      const refusal = collectRefusal(outputItems(response));
      if (refusal) {
        throw new Error(
          `OpenAI Responses recusou responder o schema "${options.schemaName}": ${refusal}`,
        );
      }

      const text = collectText(response, outputItems(response));
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        throw new Error(
          `OpenAI Responses returned non-JSON output for schema "${options.schemaName}"`,
        );
      }

      const parsed = options.schema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new Error(
          `OpenAI Responses output failed schema "${options.schemaName}": ${parsed.error.message}`,
        );
      }

      const usage = response.usage && {
        promptTokens: response.usage.input_tokens ?? 0,
        completionTokens: response.usage.output_tokens ?? 0,
      };
      return { value: parsed.data, output: parsed.data, usage };
    });
  }

  private async traced<T>(
    options: ResponsesTraceOptions,
    input: unknown,
    call: () => Promise<{
      value: T;
      output: unknown;
      usage?: TraceUsage;
    }>,
  ): Promise<T> {
    const trace = options.trace ?? NOOP_TRACE;
    const phase = options.phase ?? 'unknown';
    const startedAt = Date.now();
    try {
      const { value, output, usage } = await call();
      trace.llm({
        phase,
        model: OPENAI_MODEL,
        messages: summarizeMessages(input),
        output,
        ...(usage ? { usage } : {}),
        durationMs: Date.now() - startedAt,
      });
      return value;
    } catch (error) {
      trace.llm({
        phase,
        model: OPENAI_MODEL,
        messages: summarizeMessages(input),
        output: null,
        durationMs: Date.now() - startedAt,
        error,
      });
      throw error;
    }
  }
}
