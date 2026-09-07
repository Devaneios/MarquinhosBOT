import { describe, expect, it, mock } from 'bun:test';
import type OpenAI from 'openai';
import type { TraceLlmEvent } from 'services/aiChat/AiTraceRecorder';
import { OpenAiClient } from 'services/aiChat/OpenAiClient';
import { MAIN_CLASSIFY_SYSTEM_PROMPT } from 'services/aiChat/prompts';
import { z } from 'zod';

function fakeSdkClient(overrides: {
  create?: (...args: unknown[]) => unknown;
  parse?: (...args: unknown[]) => unknown;
}) {
  return {
    chat: {
      completions: {
        create: mock(overrides.create ?? (async () => ({}))),
        parse: mock(overrides.parse ?? (async () => ({}))),
      },
    },
  } as unknown as OpenAI;
}

describe('OpenAiClient.chat', () => {
  it('returns the assistant message content from the API response', async () => {
    const sdk = fakeSdkClient({
      create: async () => ({
        choices: [{ message: { content: 'oi tudo bem' } }],
      }),
    });

    const client = new OpenAiClient(sdk);
    const result = await client.chat({
      messages: [{ role: 'user', content: 'oi' }],
      temperature: 0.5,
      maxTokens: 50,
    });

    expect(result).toBe('oi tudo bem');
  });

  it('calls the SDK with model gpt-5.4-mini and the given messages/params', async () => {
    const sdk = fakeSdkClient({
      create: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const client = new OpenAiClient(sdk);
    await client.chat({
      messages: [{ role: 'user', content: 'oi' }],
      temperature: 0.5,
      maxTokens: 50,
    });

    expect(sdk.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        messages: [{ role: 'user', content: 'oi' }],
        temperature: 0.5,
        max_completion_tokens: 50,
      }),
    );
  });

  it('throws when the SDK returns no completion content', async () => {
    const sdk = fakeSdkClient({
      create: async () => ({ choices: [{ message: { content: null } }] }),
    });

    const client = new OpenAiClient(sdk);
    expect(
      client.chat({
        messages: [{ role: 'user', content: 'oi' }],
        temperature: 0.5,
        maxTokens: 50,
      }),
    ).rejects.toThrow();
  });
});

describe('OpenAiClient.structured', () => {
  const schema = z.object({ category: z.enum(['a', 'b']) });

  it('returns the parsed, schema-validated object from the SDK', async () => {
    const sdk = fakeSdkClient({
      parse: async () => ({
        choices: [{ message: { parsed: { category: 'a' } } }],
      }),
    });

    const client = new OpenAiClient(sdk);
    const result = await client.structured(
      [{ role: 'system', content: 'classify' }],
      schema,
      'classification',
      { temperature: 0.1, maxTokens: 20 },
    );

    expect(result).toEqual({ category: 'a' });
  });

  it('calls chat.completions.parse with a json_schema response_format built from the zod schema', async () => {
    const sdk = fakeSdkClient({
      parse: async () => ({
        choices: [{ message: { parsed: { category: 'a' } } }],
      }),
    });

    const client = new OpenAiClient(sdk);
    await client.structured(
      [{ role: 'system', content: 'classify' }],
      schema,
      'classification',
      { temperature: 0.1, maxTokens: 20 },
    );

    expect(sdk.chat.completions.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        response_format: expect.objectContaining({
          type: 'json_schema',
          json_schema: expect.objectContaining({
            name: 'classification',
            strict: true,
          }),
        }),
      }),
    );
  });

  it('throws when the SDK returns no parsed classification', async () => {
    const sdk = fakeSdkClient({
      parse: async () => ({ choices: [{ message: { parsed: null } }] }),
    });

    const client = new OpenAiClient(sdk);
    expect(
      client.structured(
        [{ role: 'system', content: 'classify' }],
        schema,
        'classification',
        { temperature: 0.1, maxTokens: 20 },
      ),
    ).rejects.toThrow();
  });
});

describe('OpenAiClient.chatWithTools', () => {
  it('calls the SDK with tools and tool_choice auto', async () => {
    const sdk = fakeSdkClient({
      create: async () => ({
        choices: [{ message: { role: 'assistant', content: 'oi' } }],
      }),
    });
    const client = new OpenAiClient(sdk);
    const tools = [
      {
        type: 'function' as const,
        function: { name: 'foo', description: 'desc', parameters: {} },
      },
    ];

    await client.chatWithTools([{ role: 'user', content: 'oi' }], tools, {
      temperature: 0.5,
      maxTokens: 50,
    });

    expect(sdk.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        tools,
        tool_choice: 'auto',
        temperature: 0.5,
        max_completion_tokens: 50,
      }),
    );
  });

  it('forwards tool_choice none so a wrap-up call cannot start another tool call', async () => {
    const sdk = fakeSdkClient({
      create: async () => ({
        choices: [{ message: { role: 'assistant', content: 'resumo' } }],
      }),
    });
    const client = new OpenAiClient(sdk);

    await client.chatWithTools(
      [{ role: 'user', content: 'resume' }],
      [
        {
          type: 'function' as const,
          function: { name: 'foo', description: 'desc', parameters: {} },
        },
      ],
      { temperature: 0.3, maxTokens: 50, toolChoice: 'none' },
    );

    expect(sdk.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({ tool_choice: 'none' }),
    );
  });

  it('returns the full assistant message when there are no tool calls', async () => {
    const sdk = fakeSdkClient({
      create: async () => ({
        choices: [
          { message: { role: 'assistant', content: 'resposta final' } },
        ],
      }),
    });
    const client = new OpenAiClient(sdk);

    const result = await client.chatWithTools(
      [{ role: 'user', content: 'oi' }],
      [],
      { temperature: 0.5, maxTokens: 50 },
    );

    expect(result.content).toBe('resposta final');
    expect(result.tool_calls).toBeUndefined();
  });

  it('returns the full assistant message including tool_calls when present', async () => {
    const toolCalls = [
      {
        id: 'call_1',
        type: 'function' as const,
        function: { name: 'list_directory', arguments: '{"path":"/repo"}' },
      },
    ];
    const sdk = fakeSdkClient({
      create: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: toolCalls,
            },
          },
        ],
      }),
    });
    const client = new OpenAiClient(sdk);

    const result = await client.chatWithTools(
      [{ role: 'user', content: 'lista os arquivos' }],
      [],
      { temperature: 0.5, maxTokens: 50 },
    );

    expect(result.tool_calls).toEqual(toolCalls);
  });

  it('throws when the SDK returns no completion message', async () => {
    const sdk = fakeSdkClient({ create: async () => ({ choices: [] }) });
    const client = new OpenAiClient(sdk);

    expect(
      client.chatWithTools([{ role: 'user', content: 'oi' }], [], {
        temperature: 0.5,
        maxTokens: 50,
      }),
    ).rejects.toThrow();
  });
});

describe('OpenAiClient tracing', () => {
  function recordingTrace() {
    return {
      traceId: 'trace-1',
      llm: mock(() => undefined),
      tool: mock(() => undefined),
      exec: mock(() => undefined),
      sandbox: mock(() => undefined),
      finish: mock(() => undefined),
    };
  }

  function llmEvents(trace: { llm: unknown }): TraceLlmEvent[] {
    return (trace.llm as unknown as ReturnType<typeof mock>).mock.calls.map(
      (call) => call[0] as TraceLlmEvent,
    );
  }

  it('records phase, latency and the token usage the SDK reports', async () => {
    const sdk = fakeSdkClient({
      create: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 42, completion_tokens: 7 },
      }),
    });
    const trace = recordingTrace();

    await new OpenAiClient(sdk).chat({
      messages: [{ role: 'user', content: 'oi' }],
      temperature: 0.5,
      maxTokens: 50,
      trace,
      phase: 'generate',
    });

    const [event] = llmEvents(trace);
    expect(event!.phase).toBe('generate');
    expect(event!.output).toBe('ok');
    expect(event!.usage).toEqual({ promptTokens: 42, completionTokens: 7 });
    expect(event!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('replaces static system prompts with a reference but keeps dynamic content verbatim', async () => {
    const sdk = fakeSdkClient({
      create: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const trace = recordingTrace();

    await new OpenAiClient(sdk).chat({
      messages: [
        { role: 'system', content: MAIN_CLASSIFY_SYSTEM_PROMPT },
        { role: 'user', content: 'quantos anos tem o pedro?' },
      ],
      temperature: 0.1,
      maxTokens: 20,
      trace,
      phase: 'classify_main',
    });

    const [event] = llmEvents(trace);
    const messages = event!.messages as {
      content?: string;
      promptRef?: { promptId: string; sha1: string };
    }[];
    expect(messages[0]!.content).toBeUndefined();
    expect(messages[0]!.promptRef?.promptId).toBe(
      'MAIN_CLASSIFY_SYSTEM_PROMPT',
    );
    expect(messages[0]!.promptRef?.sha1).toHaveLength(12);
    expect(messages[1]!.content).toBe('quantos anos tem o pedro?');
  });

  it('records the failure and rethrows when the SDK call blows up', async () => {
    const sdk = fakeSdkClient({
      create: async () => {
        throw new Error('openai down');
      },
    });
    const trace = recordingTrace();

    expect(
      new OpenAiClient(sdk).chat({
        messages: [{ role: 'user', content: 'oi' }],
        temperature: 0.5,
        maxTokens: 50,
        trace,
        phase: 'generate',
      }),
    ).rejects.toThrow('openai down');

    const [event] = llmEvents(trace);
    expect((event!.error as Error).message).toBe('openai down');
  });
});
