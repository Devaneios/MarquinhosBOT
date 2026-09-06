import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';
import { AiTraceRecorder, NOOP_TRACE } from 'services/aiChat/AiTraceRecorder';

function setupDb(): Database {
  const db = new Database(':memory:');
  db.run(`
    CREATE TABLE ai_traces (
      trace_id          TEXT NOT NULL PRIMARY KEY,
      user_id           TEXT NOT NULL,
      guild_id          TEXT NOT NULL,
      channel_id        TEXT NOT NULL,
      content           TEXT NOT NULL,
      main_category     TEXT,
      category          TEXT,
      status            TEXT,
      reply             TEXT,
      format            TEXT,
      error             TEXT,
      iterations        INTEGER NOT NULL DEFAULT 0,
      tool_calls_used   INTEGER NOT NULL DEFAULT 0,
      prompt_tokens     INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      duration_ms       INTEGER,
      created_at        INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE ai_trace_events (
      id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      trace_id    TEXT NOT NULL,
      seq         INTEGER NOT NULL,
      type        TEXT NOT NULL,
      phase       TEXT,
      name        TEXT,
      input       TEXT,
      output      TEXT,
      status      TEXT,
      exit_code   INTEGER,
      duration_ms INTEGER,
      created_at  INTEGER NOT NULL
    )
  `);
  return db;
}

const baseRequest = {
  userId: 'user1',
  guildId: 'guild1',
  channelId: 'channel1',
  content: 'roda um script python',
  recentMessages: [],
};

function events(db: Database) {
  return db
    .query<
      {
        seq: number;
        type: string;
        phase: string | null;
        name: string | null;
        input: string | null;
        output: string | null;
        status: string | null;
        exit_code: number | null;
      },
      []
    >('SELECT * FROM ai_trace_events ORDER BY seq')
    .all();
}

afterEach(() => {
  delete process.env.AI_TRACE_ENABLED;
});

describe('AiTraceRecorder', () => {
  it('inserts a trace row on start and returns a usable trace id', () => {
    const db = setupDb();
    const trace = new AiTraceRecorder(db).start(baseRequest);

    expect(trace.traceId).toMatch(/^[0-9a-f-]{36}$/);
    const row = db
      .query<{ trace_id: string; user_id: string; content: string }, []>(
        'SELECT * FROM ai_traces',
      )
      .get();
    expect(row?.trace_id).toBe(trace.traceId);
    expect(row?.user_id).toBe('user1');
    expect(row?.content).toBe('roda um script python');
  });

  it('records llm, tool, exec and sandbox events in order with full payloads', () => {
    const db = setupDb();
    const trace = new AiTraceRecorder(db).start(baseRequest);

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

    const rows = events(db);
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

  it('accumulates token usage and writes the summary on finish', () => {
    const db = setupDb();
    const trace = new AiTraceRecorder(db).start(baseRequest);

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

    const row = db
      .query<
        {
          status: string;
          category: string;
          reply: string;
          prompt_tokens: number;
          completion_tokens: number;
          iterations: number;
          tool_calls_used: number;
          duration_ms: number;
        },
        []
      >('SELECT * FROM ai_traces')
      .get();

    expect(row?.status).toBe('ok');
    expect(row?.category).toBe('agent_task');
    expect(row?.reply).toBe('pronto');
    expect(row?.prompt_tokens).toBe(40);
    expect(row?.completion_tokens).toBe(10);
    expect(row?.iterations).toBe(2);
    expect(row?.tool_calls_used).toBe(3);
    expect(row?.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('serializes errors on finish instead of dropping them', () => {
    const db = setupDb();
    const trace = new AiTraceRecorder(db).start(baseRequest);

    trace.finish({ status: 'error', error: new Error('docker unreachable') });

    const row = db
      .query<{ status: string; error: string }, []>('SELECT * FROM ai_traces')
      .get();
    expect(row?.status).toBe('error');
    expect(row?.error).toContain('docker unreachable');
  });

  it('never throws when persistence fails', () => {
    const db = setupDb();
    const recorder = new AiTraceRecorder(db);
    const trace = recorder.start(baseRequest);
    db.run('DROP TABLE ai_trace_events');
    db.run('DROP TABLE ai_traces');

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
  });

  it('returns the noop trace and writes nothing when tracing is disabled', () => {
    process.env.AI_TRACE_ENABLED = 'false';
    const db = setupDb();
    const trace = new AiTraceRecorder(db).start(baseRequest);

    trace.tool({
      name: 'read_file',
      iteration: 0,
      rawArguments: '{}',
      status: 'success',
      durationMs: 1,
    });
    trace.finish({ status: 'ok' });

    expect(trace).toBe(NOOP_TRACE);
    expect(
      db.query<{ c: number }, []>('SELECT COUNT(*) AS c FROM ai_traces').get()
        ?.c,
    ).toBe(0);
    expect(events(db)).toHaveLength(0);
  });

  it('exposes a stable no-op trace that ignores every call', () => {
    expect(NOOP_TRACE.traceId).toBe('');
    expect(() =>
      NOOP_TRACE.sandbox({ action: 'session_reused' }),
    ).not.toThrow();
    expect(() => NOOP_TRACE.finish({ status: 'ok' })).not.toThrow();
  });
});
