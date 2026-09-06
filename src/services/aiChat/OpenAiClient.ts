import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { NOOP_TRACE, type TraceContext } from 'services/aiChat/AiTraceRecorder';
import { summarizeMessages } from 'services/aiChat/promptRegistry';
import type { ZodType } from 'zod';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const REQUEST_TIMEOUT_MS = 30000;

export interface OpenAiTraceOptions {
  trace?: TraceContext;
  phase?: string;
}

export interface OpenAiMessage {
  role: 'system' | 'user';
  content: string;
}

export interface OpenAiChatOptions extends OpenAiTraceOptions {
  messages: OpenAiMessage[];
  temperature: number;
  maxTokens: number;
}

export interface OpenAiStructuredOptions extends OpenAiTraceOptions {
  temperature: number;
  maxTokens: number;
}

export interface OpenAiToolMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
  tool_call_id?: string;
}

export class OpenAiClient {
  constructor(
    private client: OpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    }),
  ) {}

  async chat(options: OpenAiChatOptions): Promise<string> {
    return this.traced(options, options.messages, async () => {
      const completion = await this.client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: options.messages,
        temperature: options.temperature,
        max_completion_tokens: options.maxTokens,
      });

      const content = completion.choices[0]?.message?.content;
      if (content === null || content === undefined) {
        throw new Error('OpenAI returned no completion content');
      }
      return { value: content, output: content, usage: completion.usage };
    });
  }

  async structured<T>(
    messages: OpenAiMessage[],
    schema: ZodType<T>,
    schemaName: string,
    options: OpenAiStructuredOptions,
  ): Promise<T> {
    return this.traced(options, messages, async () => {
      const completion = await this.client.chat.completions.parse({
        model: OPENAI_MODEL,
        messages,
        temperature: options.temperature,
        max_completion_tokens: options.maxTokens,
        response_format: zodResponseFormat(schema, schemaName),
      });

      const parsed = completion.choices[0]?.message?.parsed;
      if (parsed === null || parsed === undefined) {
        throw new Error('OpenAI returned no parsed structured output');
      }
      return { value: parsed, output: parsed, usage: completion.usage };
    });
  }

  async chatWithTools(
    messages: OpenAiToolMessage[],
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    options: OpenAiTraceOptions & {
      temperature: number;
      maxTokens: number;
      toolChoice?: 'auto' | 'none';
    },
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> {
    return this.traced(options, messages, async () => {
      const completion = await this.client.chat.completions.create({
        model: OPENAI_MODEL,
        messages:
          messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools,
        tool_choice: options.toolChoice ?? 'auto',
        temperature: options.temperature,
        max_completion_tokens: options.maxTokens,
      });

      const message = completion.choices[0]?.message;
      if (!message) {
        throw new Error('OpenAI returned no completion message');
      }
      return { value: message, output: message, usage: completion.usage };
    });
  }

  private async traced<T>(
    options: OpenAiTraceOptions,
    messages: unknown,
    call: () => Promise<{
      value: T;
      output: unknown;
      usage?: OpenAI.Completions.CompletionUsage;
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
        messages: summarizeMessages(messages),
        output,
        usage: usage && {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
        },
        durationMs: Date.now() - startedAt,
      });
      return value;
    } catch (error) {
      trace.llm({
        phase,
        model: OPENAI_MODEL,
        messages: summarizeMessages(messages),
        output: null,
        durationMs: Date.now() - startedAt,
        error,
      });
      throw error;
    }
  }
}
