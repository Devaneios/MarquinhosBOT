import { describe, expect, it, mock } from 'bun:test';
import {
  TOOL_RESULT_MAX_CHARS,
  ToolDispatcher,
} from 'services/aiChat/agent/ToolDispatcher';
import type {
  TraceExecEvent,
  TraceToolEvent,
} from 'services/aiChat/AiTraceRecorder';
import type { SandboxManager } from 'services/aiChat/sandbox/SandboxManager';

function fakeSandbox(
  exec: () => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> = async () => ({
    stdout: 'ok',
    stderr: '',
    exitCode: 0,
  }),
): SandboxManager {
  return { exec: mock(exec) } as unknown as SandboxManager;
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

function callsOf<T>(fn: unknown): T[] {
  return (fn as unknown as ReturnType<typeof mock>).mock.calls.map(
    (call) => call[0] as T,
  );
}

describe('ToolDispatcher.dispatch', () => {
  it('runs the named tool and returns a success envelope', async () => {
    const dispatcher = new ToolDispatcher(
      fakeSandbox(async () => ({
        stdout: 'index.ts\nfoo.ts',
        stderr: '',
        exitCode: 0,
      })),
    );

    const raw = await dispatcher.dispatch(
      { name: 'list_directory', rawArguments: '{"path":"/repo"}' },
      'container-1',
    );

    const parsed = JSON.parse(raw) as { status: string; result: string };
    expect(parsed.status).toBe('success');
    expect(parsed.result).toContain('index.ts');
  });

  it('returns an error envelope for an unknown tool without touching the sandbox', async () => {
    const sandbox = fakeSandbox();
    const dispatcher = new ToolDispatcher(sandbox);

    const raw = await dispatcher.dispatch(
      { name: 'rm_rf', rawArguments: '{}' },
      'container-1',
    );

    expect(JSON.parse(raw)).toMatchObject({ status: 'error' });
    expect(JSON.parse(raw).message).toContain('rm_rf');
    expect(sandbox.exec).not.toHaveBeenCalled();
  });

  it('returns a correctable error envelope for malformed json arguments', async () => {
    const dispatcher = new ToolDispatcher(fakeSandbox());

    const raw = await dispatcher.dispatch(
      { name: 'read_file', rawArguments: 'not json' },
      'container-1',
    );

    const parsed = JSON.parse(raw) as { status: string; message: string };
    expect(parsed.status).toBe('error');
    expect(parsed.message).toContain('JSON');
  });

  it('turns a tool throw into an error envelope instead of propagating it', async () => {
    const dispatcher = new ToolDispatcher(
      fakeSandbox(async () => {
        throw new Error('container gone');
      }),
    );

    const raw = await dispatcher.dispatch(
      { name: 'list_directory', rawArguments: '{"path":"/repo"}' },
      'container-1',
    );

    const parsed = JSON.parse(raw) as { status: string; message: string };
    expect(parsed.status).toBe('error');
    expect(parsed.message).toContain('container gone');
  });

  it('caps the result the model sees', async () => {
    const dispatcher = new ToolDispatcher(
      fakeSandbox(async () => ({
        stdout: 'x'.repeat(20_000),
        stderr: '',
        exitCode: 0,
      })),
    );

    const raw = await dispatcher.dispatch(
      { name: 'list_directory', rawArguments: '{"path":"/repo"}' },
      'container-1',
    );

    const parsed = JSON.parse(raw) as { result: string };
    expect(parsed.result.length).toBeLessThanOrEqual(TOOL_RESULT_MAX_CHARS);
  });
});

describe('ToolDispatcher tracing', () => {
  it('records the tool call with raw arguments and the parsed args', async () => {
    const trace = recordingTrace();
    const dispatcher = new ToolDispatcher(
      fakeSandbox(async () => ({ stdout: 'ok', stderr: '', exitCode: 0 })),
    );

    await dispatcher.dispatch(
      { name: 'execute_code', rawArguments: '{"language":"bash","code":"ls"}' },
      'container-1',
      trace,
      3,
    );

    const event = callsOf<TraceToolEvent>(trace.tool)[0]!;
    expect(event).toMatchObject({
      name: 'execute_code',
      iteration: 3,
      status: 'success',
      rawArguments: '{"language":"bash","code":"ls"}',
    });
    expect(event.args).toEqual({ language: 'bash', code: 'ls' });
  });

  it('keeps the full container stdout on the exec event even though the model only sees 4000 chars', async () => {
    const trace = recordingTrace();
    const dispatcher = new ToolDispatcher(
      fakeSandbox(async () => ({
        stdout: 'y'.repeat(9000),
        stderr: '',
        exitCode: 0,
      })),
    );

    const raw = await dispatcher.dispatch(
      { name: 'execute_code', rawArguments: '{"language":"bash","code":"ls"}' },
      'container-1',
      trace,
    );

    expect(callsOf<TraceExecEvent>(trace.exec)[0]!.stdout.length).toBe(9000);
    expect(
      (JSON.parse(raw) as { result: string }).result.length,
    ).toBeLessThanOrEqual(TOOL_RESULT_MAX_CHARS);
  });

  it('records the argv actually run in the container', async () => {
    const trace = recordingTrace();
    const dispatcher = new ToolDispatcher(
      fakeSandbox(async () => ({ stdout: '4', stderr: '', exitCode: 0 })),
    );

    await dispatcher.dispatch(
      {
        name: 'execute_code',
        rawArguments: '{"language":"python","code":"print(2+2)"}',
      },
      'container-9',
      trace,
    );

    expect(callsOf<TraceExecEvent>(trace.exec)[0]!).toMatchObject({
      containerId: 'container-9',
      argv: ['python3', '-c', 'print(2+2)'],
      exitCode: 0,
    });
  });

  it('records a failed exec with exit code -1 and the error on stderr', async () => {
    const trace = recordingTrace();
    const dispatcher = new ToolDispatcher(
      fakeSandbox(async () => {
        throw new Error('docker down');
      }),
    );

    await dispatcher.dispatch(
      { name: 'execute_code', rawArguments: '{"language":"bash","code":"ls"}' },
      'container-1',
      trace,
    );

    expect(callsOf<TraceExecEvent>(trace.exec)[0]!).toMatchObject({
      stderr: 'docker down',
      exitCode: -1,
    });
    expect(callsOf<TraceToolEvent>(trace.tool)[0]!.status).toBe('error');
  });

  it('records an unknown tool as a failed tool call', async () => {
    const trace = recordingTrace();
    const dispatcher = new ToolDispatcher(fakeSandbox());

    await dispatcher.dispatch(
      { name: 'nope', rawArguments: '{}' },
      'c1',
      trace,
      2,
    );

    expect(callsOf<TraceToolEvent>(trace.tool)[0]!).toMatchObject({
      name: 'nope',
      iteration: 2,
      status: 'error',
    });
  });

  it('works without a trace, so callers that do not trace need no null checks', async () => {
    const dispatcher = new ToolDispatcher(fakeSandbox());

    const raw = await dispatcher.dispatch(
      { name: 'list_directory', rawArguments: '{"path":"/repo"}' },
      'c1',
    );

    expect(JSON.parse(raw).status).toBe('success');
  });
});

describe('ToolDispatcher.budgetExhausted', () => {
  it('returns an error envelope explaining the budget is spent', () => {
    const dispatcher = new ToolDispatcher(fakeSandbox());

    const parsed = JSON.parse(
      dispatcher.budgetExhausted(recordingTrace(), 5, 30),
    ) as { status: string; message: string };

    expect(parsed.status).toBe('error');
    expect(parsed.message.toLowerCase()).toContain('orçamento');
  });
});
