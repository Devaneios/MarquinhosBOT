import { describe, expect, it, mock } from 'bun:test';
import type OpenAI from 'openai';
import type { TraceLlmEvent } from 'services/aiChat/AiTraceRecorder';
import { ResponsesClient } from 'services/aiChat/llm/ResponsesClient';
import { AGENT_TASK_SYSTEM_PROMPT } from 'services/aiChat/prompts';
import { z } from 'zod';

function fakeSdk(create: (...args: unknown[]) => unknown) {
  return {
    responses: { create: mock(create) },
  } as unknown as OpenAI;
}

function textResponse(text: string, extra: Record<string, unknown> = {}) {
  return {
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text }],
      },
    ],
    output_text: text,
    ...extra,
  };
}

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

const userInput = [{ role: 'user' as const, content: 'oi' }];

describe('ResponsesClient.create request shape', () => {
  it('sends the model, input, instructions and max_output_tokens', async () => {
    const sdk = fakeSdk(async () => textResponse('ok'));

    await new ResponsesClient(sdk).create({
      instructions: 'seja breve',
      input: userInput,
      maxOutputTokens: 500,
    });

    expect(sdk.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        instructions: 'seja breve',
        input: userInput,
        max_output_tokens: 500,
      }),
    );
  });

  it('asks for reasoning across all turns so earlier reasoning stays in context', async () => {
    const sdk = fakeSdk(async () => textResponse('ok'));

    await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    const params = (sdk.responses.create as unknown as ReturnType<typeof mock>)
      .mock.calls[0]?.[0] as { reasoning: Record<string, unknown> };
    expect(params.reasoning).toMatchObject({
      effort: 'medium',
      summary: 'auto',
      context: 'all_turns',
    });
  });

  it('keeps state on our side: store false plus encrypted reasoning included', async () => {
    const sdk = fakeSdk(async () => textResponse('ok'));

    await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    expect(sdk.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({
        store: false,
        include: ['reasoning.encrypted_content'],
      }),
    );
  });

  it('honours an explicit reasoning effort', async () => {
    const sdk = fakeSdk(async () => textResponse('ok'));

    await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
      reasoningEffort: 'high',
    });

    const params = (sdk.responses.create as unknown as ReturnType<typeof mock>)
      .mock.calls[0]?.[0] as { reasoning: { effort: string } };
    expect(params.reasoning.effort).toBe('high');
  });

  it('never sends temperature, which reasoning models reject', async () => {
    const sdk = fakeSdk(async () => textResponse('ok'));

    await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    const params = (sdk.responses.create as unknown as ReturnType<typeof mock>)
      .mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params).not.toHaveProperty('temperature');
  });

  it('sends function tools in the flat Responses shape, not the nested chat shape', async () => {
    const sdk = fakeSdk(async () => textResponse('ok'));

    await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
      tools: [
        {
          name: 'search_web',
          description: 'busca',
          parameters: { type: 'object' },
        },
      ],
    });

    const params = (sdk.responses.create as unknown as ReturnType<typeof mock>)
      .mock.calls[0]?.[0] as { tools: Record<string, unknown>[] };
    expect(params.tools[0]).toEqual({
      type: 'function',
      name: 'search_web',
      description: 'busca',
      parameters: { type: 'object' },
      strict: false,
    });
  });

  it('omits tools and tool_choice entirely when no tools are given', async () => {
    const sdk = fakeSdk(async () => textResponse('ok'));

    await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    const params = (sdk.responses.create as unknown as ReturnType<typeof mock>)
      .mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params).not.toHaveProperty('tools');
    expect(params).not.toHaveProperty('tool_choice');
  });

  it('forwards tool_choice none so a wrap-up call cannot start another tool call', async () => {
    const sdk = fakeSdk(async () => textResponse('resumo'));

    await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
      tools: [{ name: 'f', description: 'd', parameters: {} }],
      toolChoice: 'none',
    });

    expect(sdk.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({ tool_choice: 'none' }),
    );
  });
});

describe('ResponsesClient.create result', () => {
  it('returns the concatenated output text', async () => {
    const sdk = fakeSdk(async () => textResponse('resposta final'));

    const result = await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    expect(result.text).toBe('resposta final');
  });

  it('builds the text from output items when output_text is absent', async () => {
    const sdk = fakeSdk(async () => ({
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'output_text', text: 'parte 1 ' },
            { type: 'output_text', text: 'parte 2' },
          ],
        },
      ],
    }));

    const result = await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    expect(result.text).toBe('parte 1 parte 2');
  });

  it('returns the raw output items so reasoning can be replayed verbatim', async () => {
    const reasoningItem = {
      type: 'reasoning',
      id: 'rs_1',
      summary: [{ type: 'summary_text', text: 'pensei nisso' }],
      encrypted_content: 'ENCRYPTED_BLOB',
    };
    const sdk = fakeSdk(async () => ({
      output: [
        reasoningItem,
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'ok' }],
        },
      ],
      output_text: 'ok',
    }));

    const result = await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    expect(result.items[0]).toEqual(reasoningItem);
    expect(result.items).toHaveLength(2);
  });

  it('surfaces reasoning summaries separately for tracing', async () => {
    const sdk = fakeSdk(async () => ({
      output: [
        {
          type: 'reasoning',
          id: 'rs_1',
          summary: [
            { type: 'summary_text', text: 'primeiro' },
            { type: 'summary_text', text: 'segundo' },
          ],
          encrypted_content: 'BLOB',
        },
      ],
      output_text: '',
    }));

    const result = await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    expect(result.reasoningSummaries).toEqual(['primeiro', 'segundo']);
  });

  it('extracts function calls with their call ids and raw arguments', async () => {
    const sdk = fakeSdk(async () => ({
      output: [
        {
          type: 'function_call',
          call_id: 'fc_1',
          name: 'search_web',
          arguments: '{"query":"recife"}',
        },
      ],
      output_text: '',
    }));

    const result = await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    expect(result.functionCalls).toEqual([
      { callId: 'fc_1', name: 'search_web', arguments: '{"query":"recife"}' },
    ]);
  });

  it('reports no function calls when the model answered in text', async () => {
    const sdk = fakeSdk(async () => textResponse('só texto'));

    const result = await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    expect(result.functionCalls).toEqual([]);
  });

  it('maps Responses usage onto prompt/completion tokens', async () => {
    const sdk = fakeSdk(async () =>
      textResponse('ok', {
        usage: { input_tokens: 120, output_tokens: 30 },
      }),
    );

    const result = await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
    });

    expect(result.usage).toEqual({ promptTokens: 120, completionTokens: 30 });
  });

  it('throws when the API returns no output items at all', async () => {
    const sdk = fakeSdk(async () => ({ output: [] }));

    expect(
      new ResponsesClient(sdk).create({
        input: userInput,
        maxOutputTokens: 100,
      }),
    ).rejects.toThrow();
  });
});

describe('ResponsesClient.structured', () => {
  const schema = z.object({ category: z.enum(['a', 'b']) });

  it('sends a json_schema text format built from the zod schema', async () => {
    const sdk = fakeSdk(async () => textResponse('{"category":"a"}'));

    await new ResponsesClient(sdk).structured({
      instructions: 'classify',
      input: userInput,
      schema,
      schemaName: 'classification',
      maxOutputTokens: 50,
    });

    const params = (sdk.responses.create as unknown as ReturnType<typeof mock>)
      .mock.calls[0]?.[0] as { text: { format: Record<string, unknown> } };
    expect(params.text.format).toMatchObject({
      type: 'json_schema',
      name: 'classification',
      strict: true,
    });
  });

  it('parses and validates the json against the schema', async () => {
    const sdk = fakeSdk(async () => textResponse('{"category":"b"}'));

    const result = await new ResponsesClient(sdk).structured({
      input: userInput,
      schema,
      schemaName: 'classification',
      maxOutputTokens: 50,
    });

    expect(result).toEqual({ category: 'b' });
  });

  it('throws when the model returns json that does not satisfy the schema', async () => {
    const sdk = fakeSdk(async () => textResponse('{"category":"z"}'));

    expect(
      new ResponsesClient(sdk).structured({
        input: userInput,
        schema,
        schemaName: 'classification',
        maxOutputTokens: 50,
      }),
    ).rejects.toThrow();
  });

  it('throws when the model returns text that is not json at all', async () => {
    const sdk = fakeSdk(async () => textResponse('desculpa, não sei'));

    expect(
      new ResponsesClient(sdk).structured({
        input: userInput,
        schema,
        schemaName: 'classification',
        maxOutputTokens: 50,
      }),
    ).rejects.toThrow();
  });
});

describe('ResponsesClient truncated structured output', () => {
  const schema = z.object({ category: z.enum(['a', 'b']) });

  /**
   * What the API returns when reasoning ate the whole token budget: an
   * incomplete response carrying no message item at all.
   */
  function truncatedResponse() {
    return {
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [{ type: 'reasoning', id: 'rs_1', summary: [] }],
      output_text: '',
    };
  }

  it('retries once with a bigger budget instead of failing on empty output', async () => {
    let call = 0;
    const sdk = fakeSdk(async () =>
      call++ === 0 ? truncatedResponse() : textResponse('{"category":"a"}'),
    );

    const result = await new ResponsesClient(sdk).structured({
      input: userInput,
      schema,
      schemaName: 'classification',
      maxOutputTokens: 500,
    });

    expect(result).toEqual({ category: 'a' });
    const calls = (sdk.responses.create as unknown as ReturnType<typeof mock>)
      .mock.calls as { max_output_tokens: number }[][];
    expect(calls[0]![0]!.max_output_tokens).toBe(500);
    expect(calls[1]![0]!.max_output_tokens).toBe(1000);
  });

  it('says the output was truncated when the retry is truncated too', async () => {
    const sdk = fakeSdk(async () => truncatedResponse());

    expect(
      new ResponsesClient(sdk).structured({
        input: userInput,
        schema,
        schemaName: 'classification',
        maxOutputTokens: 500,
      }),
    ).rejects.toThrow(/truncou.*max_output_tokens/i);
  });

  it('reports a refusal as a refusal instead of as unparseable json', async () => {
    const sdk = fakeSdk(async () => ({
      status: 'completed',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'refusal', refusal: 'não posso pesquisar isso' }],
        },
      ],
      output_text: '',
    }));

    expect(
      new ResponsesClient(sdk).structured({
        input: userInput,
        schema,
        schemaName: 'classification',
        maxOutputTokens: 500,
      }),
    ).rejects.toThrow(/recusou.*não posso pesquisar isso/);
  });

  it('does not retry a response that came back complete but unparseable', async () => {
    const sdk = fakeSdk(async () => textResponse('não é json'));

    expect(
      new ResponsesClient(sdk).structured({
        input: userInput,
        schema,
        schemaName: 'classification',
        maxOutputTokens: 500,
      }),
    ).rejects.toThrow(/non-JSON/);
    expect(
      sdk.responses.create as unknown as ReturnType<typeof mock>,
    ).toHaveBeenCalledTimes(1);
  });
});

describe('ResponsesClient tracing', () => {
  it('records phase, model, latency and usage', async () => {
    const sdk = fakeSdk(async () =>
      textResponse('ok', { usage: { input_tokens: 10, output_tokens: 2 } }),
    );
    const trace = recordingTrace();

    await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
      trace,
      phase: 'thread_turn[0]',
    });

    const [event] = llmEvents(trace);
    expect(event!.phase).toBe('thread_turn[0]');
    expect(event!.model).toBe('gpt-5.4-mini');
    expect(event!.usage).toEqual({ promptTokens: 10, completionTokens: 2 });
    expect(event!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records the reasoning summary so it is debuggable without being posted to Discord', async () => {
    const sdk = fakeSdk(async () => ({
      output: [
        {
          type: 'reasoning',
          id: 'rs_1',
          summary: [{ type: 'summary_text', text: 'considerei X' }],
          encrypted_content: 'BLOB',
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'ok' }],
        },
      ],
      output_text: 'ok',
    }));
    const trace = recordingTrace();

    await new ResponsesClient(sdk).create({
      input: userInput,
      maxOutputTokens: 100,
      trace,
      phase: 'thread_turn[0]',
    });

    expect(JSON.stringify(llmEvents(trace)[0]!.output)).toContain(
      'considerei X',
    );
  });

  it('collapses static system prompts to a reference in the trace', async () => {
    const sdk = fakeSdk(async () => textResponse('ok'));
    const trace = recordingTrace();

    await new ResponsesClient(sdk).create({
      input: [
        { role: 'system', content: AGENT_TASK_SYSTEM_PROMPT },
        { role: 'user', content: 'lista os arquivos' },
      ],
      maxOutputTokens: 100,
      trace,
      phase: 'thread_turn[0]',
    });

    const messages = llmEvents(trace)[0]!.messages as {
      content?: string;
      promptRef?: { promptId: string };
    }[];
    expect(messages[0]!.content).toBeUndefined();
    expect(messages[0]!.promptRef?.promptId).toBe('AGENT_TASK_SYSTEM_PROMPT');
    expect(messages[1]!.content).toBe('lista os arquivos');
  });

  it('records the failure and rethrows when the API call blows up', async () => {
    const sdk = fakeSdk(async () => {
      throw new Error('openai down');
    });
    const trace = recordingTrace();

    expect(
      new ResponsesClient(sdk).create({
        input: userInput,
        maxOutputTokens: 100,
        trace,
        phase: 'thread_turn[0]',
      }),
    ).rejects.toThrow('openai down');

    expect((llmEvents(trace)[0]!.error as Error).message).toBe('openai down');
  });
});
