import { describe, expect, it, mock } from 'bun:test';
import {
  THREAD_DEADLINE_MS,
  ThreadAgentLoop,
  WRAP_UP_FALLBACK,
} from 'services/aiChat/agent/ThreadAgentLoop';
import { ToolDispatcher } from 'services/aiChat/agent/ToolDispatcher';
import type {
  ConversationItem,
  ResponsesClient,
  ResponsesResult,
} from 'services/aiChat/llm/ResponsesClient';
import type { SandboxManager } from 'services/aiChat/sandbox/SandboxManager';

function fakeSandbox(stdout = 'index.ts\nfoo.ts'): SandboxManager {
  return {
    exec: mock(async () => ({ stdout, stderr: '', exitCode: 0 })),
  } as unknown as SandboxManager;
}

function result(overrides: Partial<ResponsesResult> = {}): ResponsesResult {
  return {
    items: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'ok' }],
      },
    ],
    text: 'ok',
    functionCalls: [],
    reasoningSummaries: [],
    ...overrides,
  };
}

function toolCallResult(
  callId: string,
  name = 'list_directory',
  args = '{"path":"/repo"}',
): ResponsesResult {
  return {
    items: [
      {
        type: 'reasoning',
        id: `rs_${callId}`,
        summary: [{ type: 'summary_text', text: 'vou listar' }],
        encrypted_content: `BLOB_${callId}`,
      },
      { type: 'function_call', call_id: callId, name, arguments: args },
    ],
    text: '',
    functionCalls: [{ callId, name, arguments: args }],
    reasoningSummaries: ['vou listar'],
  };
}

function fakeClient(responses: (ResponsesResult | Error)[]): ResponsesClient {
  let call = 0;
  return {
    create: mock(async () => {
      const next = responses[call++];
      if (next instanceof Error) throw next;
      if (!next) throw new Error('fake client ran out of responses');
      return next;
    }),
  } as unknown as ResponsesClient;
}

function createsOf(client: ResponsesClient) {
  return (client.create as unknown as ReturnType<typeof mock>).mock.calls.map(
    (call) => call[0] as { input: ConversationItem[]; toolChoice?: string },
  );
}

const baseRun = {
  instructions: 'você é o marquinhos',
  transcript: [] as ConversationItem[],
  userContent: 'lista os arquivos em /repo',
  containerId: 'container-1',
};

function loop(
  client: ResponsesClient,
  overrides: {
    sandbox?: SandboxManager;
    now?: () => number;
    maxIterations?: number;
    maxToolCalls?: number;
  } = {},
) {
  return new ThreadAgentLoop(
    new ToolDispatcher(overrides.sandbox ?? fakeSandbox()),
    client,
    overrides.now ?? Date.now,
    overrides.maxIterations ?? 12,
    overrides.maxToolCalls ?? 24,
  );
}

describe('ThreadAgentLoop single turn', () => {
  it('returns the text when the model answers without tools', async () => {
    const client = fakeClient([result({ text: 'a resposta é 4.' })]);

    const outcome = await loop(client).run(baseRun);

    expect(outcome.text).toBe('a resposta é 4.');
    expect(outcome.reason).toBe('final_answer');
    expect(outcome.iterations).toBe(1);
    expect(outcome.toolCallsUsed).toBe(0);
  });

  it('sends the user content as a user item after the prior transcript', async () => {
    const client = fakeClient([result()]);
    const transcript: ConversationItem[] = [
      { role: 'user', content: 'turno antigo' },
      {
        type: 'reasoning',
        id: 'rs_old',
        summary: [],
        encrypted_content: 'OLD_BLOB',
      },
    ];

    await loop(client).run({ ...baseRun, transcript });

    const input = createsOf(client)[0]!.input;
    expect(input).toHaveLength(3);
    expect(input[0]).toEqual(transcript[0]!);
    expect(input[1]).toEqual(transcript[1]!);
    expect(input[2]).toEqual({
      role: 'user',
      content: 'lista os arquivos em /repo',
    });
  });

  it('forwards the instructions on every call', async () => {
    const client = fakeClient([result()]);

    await loop(client).run(baseRun);

    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: 'você é o marquinhos' }),
    );
  });

  it('offers the registered tools to the model', async () => {
    const client = fakeClient([result()]);

    await loop(client).run(baseRun);

    const params = (client.create as unknown as ReturnType<typeof mock>).mock
      .calls[0]?.[0] as { tools: { name: string }[] };
    expect(params.tools.map((t) => t.name)).toContain('search_web');
    expect(params.tools.map((t) => t.name)).toContain('fetch_url');
  });
});

describe('ThreadAgentLoop tool calling', () => {
  it('runs the tool and feeds the output back keyed by call_id', async () => {
    const client = fakeClient([
      toolCallResult('fc_1'),
      result({ text: 'são index.ts e foo.ts.' }),
    ]);

    const outcome = await loop(client).run(baseRun);

    expect(outcome.text).toBe('são index.ts e foo.ts.');
    expect(outcome.toolCallsUsed).toBe(1);

    const secondInput = createsOf(client)[1]!.input;
    const output = secondInput.find(
      (item) => item.type === 'function_call_output',
    ) as { call_id: string; output: string };
    expect(output.call_id).toBe('fc_1');
    expect(output.output).toContain('index.ts');
  });

  it('runs every tool call from one response, each with its own output item', async () => {
    const multi: ResponsesResult = {
      items: [
        {
          type: 'function_call',
          call_id: 'fc_1',
          name: 'list_directory',
          arguments: '{"path":"/repo"}',
        },
        {
          type: 'function_call',
          call_id: 'fc_2',
          name: 'read_file',
          arguments: '{"path":"/repo/a.ts"}',
        },
      ],
      text: '',
      functionCalls: [
        {
          callId: 'fc_1',
          name: 'list_directory',
          arguments: '{"path":"/repo"}',
        },
        {
          callId: 'fc_2',
          name: 'read_file',
          arguments: '{"path":"/repo/a.ts"}',
        },
      ],
      reasoningSummaries: [],
    };
    const client = fakeClient([multi, result({ text: 'pronto.' })]);

    const outcome = await loop(client).run(baseRun);

    const outputs = createsOf(client)[1]!.input.filter(
      (item) => item.type === 'function_call_output',
    ) as { call_id: string }[];
    expect(outputs.map((o) => o.call_id)).toEqual(['fc_1', 'fc_2']);
    expect(outcome.toolCallsUsed).toBe(2);
  });

  it('feeds a correctable error back when the model names a tool that does not exist', async () => {
    const client = fakeClient([
      toolCallResult('fc_1', 'rm_rf', '{}'),
      result({ text: 'ok, sem essa ferramenta.' }),
    ]);

    const outcome = await loop(client).run(baseRun);

    expect(outcome.text).toBe('ok, sem essa ferramenta.');
    const output = createsOf(client)[1]!.input.find(
      (item) => item.type === 'function_call_output',
    ) as { output: string };
    expect(JSON.parse(output.output).status).toBe('error');
  });

  it('stops running real tools once the tool-call budget is spent', async () => {
    const sandbox = fakeSandbox();
    const calls = Array.from({ length: 5 }, (_, i) => ({
      callId: `fc_${i}`,
      name: 'list_directory',
      arguments: '{"path":"/repo"}',
    }));
    const client = fakeClient([
      {
        items: calls.map((c) => ({
          type: 'function_call',
          call_id: c.callId,
          name: c.name,
          arguments: c.arguments,
        })),
        text: '',
        functionCalls: calls,
        reasoningSummaries: [],
      },
      result({ text: 'pronto.' }),
    ]);

    const outcome = await loop(client, { sandbox, maxToolCalls: 2 }).run(
      baseRun,
    );

    expect(
      (sandbox.exec as unknown as ReturnType<typeof mock>).mock.calls.length,
    ).toBe(2);
    expect(outcome.toolCallsUsed).toBe(2);
  });
});

describe('ThreadAgentLoop transcript output', () => {
  it('returns the user item first so the turn can be persisted in order', async () => {
    const client = fakeClient([result({ text: 'ok' })]);

    const outcome = await loop(client).run(baseRun);

    expect(outcome.newItems[0]).toEqual({
      role: 'user',
      content: 'lista os arquivos em /repo',
    });
  });

  it('keeps reasoning items with their encrypted content, which is what carries reasoning forward', async () => {
    const client = fakeClient([
      toolCallResult('fc_1'),
      result({ text: 'pronto.' }),
    ]);

    const outcome = await loop(client).run(baseRun);

    const reasoning = outcome.newItems.find(
      (item) => item.type === 'reasoning',
    ) as { encrypted_content: string };
    expect(reasoning.encrypted_content).toBe('BLOB_fc_1');
  });

  it('returns user item, model items and tool outputs in conversation order', async () => {
    const client = fakeClient([
      toolCallResult('fc_1'),
      result({ text: 'pronto.' }),
    ]);

    const outcome = await loop(client).run(baseRun);

    expect(
      outcome.newItems.map((item) => item.type ?? `role:${item.role}`),
    ).toEqual([
      'role:user',
      'reasoning',
      'function_call',
      'function_call_output',
      'message',
    ]);
  });
});

describe('ThreadAgentLoop budgets', () => {
  const alwaysToolCall = () => toolCallResult('fc_x');

  function clockThatJumps(stepMs: number): () => number {
    let current = 0;
    return () => {
      const value = current;
      current += stepMs;
      return value;
    };
  }

  it('wraps up after max iterations instead of looping forever', async () => {
    const client = fakeClient([
      ...Array.from({ length: 3 }, alwaysToolCall),
      result({ text: 'cheguei até aqui.' }),
    ]);

    const outcome = await loop(client, { maxIterations: 3 }).run(baseRun);

    expect(outcome.reason).toBe('max_iterations');
    expect(outcome.text).toBe('cheguei até aqui.');
  });

  it('wraps up when the wall-clock deadline passes', async () => {
    const client = fakeClient([
      alwaysToolCall(),
      result({ text: 'resumo parcial.' }),
    ]);

    const outcome = await loop(client, {
      now: clockThatJumps(THREAD_DEADLINE_MS / 2),
    }).run(baseRun);

    expect(outcome.reason).toBe('deadline');
    expect(outcome.text).toBe('resumo parcial.');
  });

  it('never lets the wrap-up call start another tool call', async () => {
    const client = fakeClient([
      alwaysToolCall(),
      result({ text: 'resumo final' }),
    ]);

    await loop(client, { now: clockThatJumps(THREAD_DEADLINE_MS) }).run(
      baseRun,
    );

    expect(createsOf(client).at(-1)?.toolChoice).toBe('none');
  });

  it('asks the wrap-up call for a summary of what it already found', async () => {
    const client = fakeClient([
      alwaysToolCall(),
      result({ text: 'achei X e Y.' }),
    ]);

    await loop(client, { now: clockThatJumps(THREAD_DEADLINE_MS) }).run(
      baseRun,
    );

    const lastInput = createsOf(client).at(-1)!.input;
    expect(String(lastInput.at(-1)?.content).toLowerCase()).toContain('resum');
  });

  it('falls back to a plain message when the wrap-up call itself fails', async () => {
    const client = fakeClient([new Error('openai down')]);

    const outcome = await loop(client, {
      now: clockThatJumps(THREAD_DEADLINE_MS),
    }).run(baseRun);

    expect(outcome.text).toBe(WRAP_UP_FALLBACK);
    expect(outcome.reason).toBe('wrap_up_failed');
  });

  it('does not trigger the deadline path on a fast answer', async () => {
    const client = fakeClient([result({ text: 'pronto.' })]);

    const outcome = await loop(client, { now: clockThatJumps(10) }).run(
      baseRun,
    );

    expect(outcome.reason).toBe('final_answer');
    expect(createsOf(client)).toHaveLength(1);
  });
});
