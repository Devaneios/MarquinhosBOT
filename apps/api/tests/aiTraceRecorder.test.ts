import { createDb } from '@marquinhos/database/client';
import { aiTraceEvents, aiTraces } from '@marquinhos/database/schema';
import { afterEach, describe, expect, it } from 'bun:test';
import { asc } from 'drizzle-orm';
import { AiTraceRecorder, NOOP_TRACE } from 'services/aiChat/AiTraceRecorder';
import { useTestDb } from './helpers/testDb';

const testDb = useTestDb();

const baseRequest = {
  userId: 'user1',
  guildId: 'guild1',
  channelId: 'channel1',
  content: 'roda um script python',
  recentMessages: [],
};

function events() {
  return testDb.current.db
    .select()
    .from(aiTraceEvents)
    .orderBy(asc(aiTraceEvents.seq));
}

async function traceRow() {
  const [row] = await testDb.current.db.select().from(aiTraces);
  return row;
}

afterEach(() => {
  delete process.env.AI_TRACE_ENABLED;
});

describe('AiTraceRecorder', () => {
  it('inserts a trace row on start and returns a usable trace id', async () => {
    const recorder = new AiTraceRecorder(testDb.current.db);
    const trace = recorder.start(baseRequest);

    expect(trace.traceId).toMatch(/^[0-9a-f-]{36}$/);
    await recorder.flush();
    const row = await traceRow();
    expect(row?.trace_id).toBe(trace.traceId);
    expect(row?.user_id).toBe('user1');
    expect(row?.content).toBe('roda um script python');
  });

  it('records llm, tool, exec and sandbox events in order with full payloads', async () => {
    const recorder = new AiTraceRecorder(testDb.current.db);
    const trace = recorder.start(baseRequest);

    trace.sandbox({ action: 'session_created', containerId: 'c1' });
    trace.llm({
      phase: 'classify_main',
      model: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: 'oi' }],
      output: { category: 'agent_task' },
      usage: { promptTokens: 10, completionTokens: 4 },
      durationMs: 120,
    });
    trace.tool({
      name: 'execute_code',
      iteration: 0,
      rawArguments: '{"language":"python","code":"print(1)"}',
      result: 'stdout:\n1',
      status: 'success',
      durationMs: 300,
    });
    trace.exec({
      containerId: 'c1',
      argv: ['python3', '-c', 'print(1)'],
      stdout: '1\n',
      stderr: '',
      exitCode: 0,
      durationMs: 250,
    });

    await recorder.flush();
    const rows = await events();
    expect(rows.map((r) => r.type)).toEqual([
      'sandbox',
      'llm_call',
      'tool_call',
      'exec',
    ]);
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4]);

    const llm = rows[1]!;
    expect(llm.phase).toBe('classify_main');
    expect(JSON.parse(llm.input ?? '{}').messages).toEqual([
      { role: 'user', content: 'oi' },
    ]);
    expect(JSON.parse(llm.output ?? '{}').output).toEqual({
      category: 'agent_task',
    });

    const tool = rows[2]!;
    expect(tool.name).toBe('execute_code');
    expect(JSON.parse(tool.input ?? '{}').rawArguments).toContain('print(1)');
    expect(JSON.parse(tool.output ?? '{}').result).toBe('stdout:\n1');

    const exec = rows[3]!;
    expect(JSON.parse(exec.input ?? '{}').argv).toEqual([
      'python3',
      '-c',
      'print(1)',
    ]);
    expect(JSON.parse(exec.output ?? '{}').stdout).toBe('1\n');
    expect(exec.exit_code).toBe(0);
  });

  it('accumulates token usage and writes the summary on finish', async () => {
    const recorder = new AiTraceRecorder(testDb.current.db);
    const trace = recorder.start(baseRequest);

    trace.llm({
      phase: 'classify_main',
      model: 'm',
      messages: [],
      output: null,
      usage: { promptTokens: 10, completionTokens: 4 },
      durationMs: 1,
    });
    trace.llm({
      phase: 'generate',
      model: 'm',
      messages: [],
      output: null,
      usage: { promptTokens: 30, completionTokens: 6 },
      durationMs: 1,
    });
    trace.finish({
      status: 'ok',
      mainCategory: 'agent_task',
      category: 'agent_task',
      reply: 'pronto',
      format: 'text',
      iterations: 2,
      toolCallsUsed: 3,
    });

    await recorder.flush();
    const row = await traceRow();

    expect(row?.status).toBe('ok');
    expect(row?.category).toBe('agent_task');
    expect(row?.reply).toBe('pronto');
    expect(row?.prompt_tokens).toBe(40);
    expect(row?.completion_tokens).toBe(10);
    expect(row?.iterations).toBe(2);
    expect(row?.tool_calls_used).toBe(3);
    expect(row?.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('serializes errors on finish instead of dropping them', async () => {
    const recorder = new AiTraceRecorder(testDb.current.db);
    const trace = recorder.start(baseRequest);

    trace.finish({ status: 'error', error: new Error('docker unreachable') });

    await recorder.flush();
    const row = await traceRow();
    expect(row?.status).toBe('error');
    expect(row?.error).toContain('docker unreachable');
  });

  it('stops tracking a trace once its finish has been written', async () => {
    const recorder = new AiTraceRecorder(testDb.current.db);
    const tracked = () =>
      (recorder as unknown as { open: Set<unknown> }).open.size;

    recorder.start(baseRequest).finish({ status: 'ok' });
    const unfinished = recorder.start(baseRequest);
    await (recorder.start(baseRequest) as unknown as { settled: Promise<void> })
      .settled;
    await Bun.sleep(50);

    expect(tracked()).toBe(2);
    unfinished.finish({ status: 'ok' });
    await recorder.flush();
    expect(tracked()).toBe(0);
  });

  it('never throws or rejects when persistence fails', async () => {
    // Nothing listens on port 1, so every write fails to connect.
    const unreachable = createDb('postgres://postgres@127.0.0.1:1/none', 1);
    const recorder = new AiTraceRecorder(unreachable.db);
    const trace = recorder.start(baseRequest);

    expect(() =>
      trace.exec({
        containerId: 'c1',
        argv: ['ls'],
        stdout: '',
        stderr: '',
        exitCode: 0,
        durationMs: 1,
      }),
    ).not.toThrow();
    expect(() => trace.finish({ status: 'ok' })).not.toThrow();
    expect(() => recorder.start(baseRequest)).not.toThrow();
    await recorder.flush();
    await unreachable.close();
  });

  it('returns the noop trace and writes nothing when tracing is disabled', async () => {
    process.env.AI_TRACE_ENABLED = 'false';
    const recorder = new AiTraceRecorder(testDb.current.db);
    const trace = recorder.start(baseRequest);

    trace.tool({
      name: 'read_file',
      iteration: 0,
      rawArguments: '{}',
      status: 'success',
      durationMs: 1,
    });
    trace.finish({ status: 'ok' });

    expect(trace).toBe(NOOP_TRACE);
    await recorder.flush();
    expect(await traceRow()).toBeUndefined();
    expect(await events()).toHaveLength(0);
  });

  it('exposes a stable no-op trace that ignores every call', () => {
    expect(NOOP_TRACE.traceId).toBe('');
    expect(() =>
      NOOP_TRACE.sandbox({ action: 'session_reused' }),
    ).not.toThrow();
    expect(() => NOOP_TRACE.finish({ status: 'ok' })).not.toThrow();
  });
});
