import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { cn } from '../lib/cn';

const MAX_LOGS = 500;

type LogKind =
  'log' | 'info' | 'warn' | 'error' | 'command' | 'result' | 'eval-error';

interface LogEntry {
  id: number;
  kind: LogKind;
  text: string;
}

export function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function')
    return `[Function: ${value.name || 'anonymous'}]`;
  if (value instanceof Error)
    return value.stack ?? `${value.name}: ${value.message}`;

  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === 'function') {
          return `[Function: ${val.name || 'anonymous'}]`;
        }
        if (typeof val === 'bigint') return `${val}n`;
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

export function formatArgs(args: unknown[]): string {
  return args.map(safeStringify).join(' ');
}

const styles: Record<string, CSSProperties> = {
  toggleButton: {
    position: 'fixed',
    right: 20,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: '1px solid #3f3f46',
    background: '#18181b',
    color: '#4ade80',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    zIndex: 99999,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
  },
  window: {
    position: 'fixed',
    right: 20,
    bottom: 20,
    width: 480,
    height: 360,
    flexDirection: 'column',
    background: '#0d0d0f',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
    zIndex: 99999,
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 12,
    overflow: 'hidden',
  },
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: '#18181b',
    color: '#e4e4e7',
    borderBottom: '1px solid #3f3f46',
  },
  titleText: {
    fontWeight: 700,
  },
  minimizeButton: {
    background: 'transparent',
    border: 'none',
    color: '#a1a1aa',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
  },
  logList: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  logLine: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    borderTop: '1px solid #3f3f46',
    padding: '6px 10px',
    gap: 6,
  },
  prompt: {
    color: '#4ade80',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#e4e4e7',
    fontFamily: 'inherit',
    fontSize: 12,
  },
};

const colorByKind: Record<LogKind, string> = {
  log: '#d4d4d8',
  info: '#60a5fa',
  warn: '#facc15',
  error: '#f87171',
  command: '#4ade80',
  result: '#a1a1aa',
  'eval-error': '#f87171',
};

const prefixByKind: Partial<Record<LogKind, string>> = {
  command: '>',
  result: '<-',
  'eval-error': '<-',
};

let nextLogId = 0;

export function DevConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [inputValue, setInputValue] = useState('');
  const logListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const original = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      clear: console.clear,
    };

    function pushLog(kind: LogKind, args: unknown[]) {
      const entry: LogEntry = { id: nextLogId++, kind, text: formatArgs(args) };
      setLogs((prev) => [...prev, entry].slice(-MAX_LOGS));
    }

    // Wrap each console method: call through to the native implementation
    // first (so the browser DevTools console keeps working untouched), then
    // mirror the same call into this component's own log buffer.
    console.log = (...args: unknown[]) => {
      original.log(...args);
      pushLog('log', args);
    };
    console.info = (...args: unknown[]) => {
      original.info(...args);
      pushLog('info', args);
    };
    console.warn = (...args: unknown[]) => {
      original.warn(...args);
      pushLog('warn', args);
    };
    console.error = (...args: unknown[]) => {
      original.error(...args);
      pushLog('error', args);
    };
    console.clear = (...args: Parameters<typeof console.clear>) => {
      original.clear(...args);
      setLogs([]);
    };

    // Restore the native console on unmount so no wrapper outlives this component.
    return () => {
      console.log = original.log;
      console.info = original.info;
      console.warn = original.warn;
      console.error = original.error;
      console.clear = original.clear;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const el = logListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [isOpen, logs]);

  function appendLog(kind: LogKind, text: string) {
    const entry: LogEntry = { id: nextLogId++, kind, text };
    setLogs((prev) => [...prev, entry].slice(-MAX_LOGS));
  }

  function runCommand() {
    const code = inputValue.trim();
    if (!code) return;

    appendLog('command', code);
    setInputValue('');

    try {
      // Indirect eval runs in global scope (like a real DevTools console)
      // instead of closing over this component's local variables.
      const result = globalThis.eval(code);
      appendLog('result', safeStringify(result));
    } catch (err) {
      const text =
        err instanceof Error ? (err.stack ?? err.message) : String(err);
      appendLog('eval-error', text);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') runCommand();
  }

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          style={styles.toggleButton}
          onClick={() => setIsOpen(true)}
          aria-label="Open dev console"
        >
          {'>_'}
        </button>
      )}
      <div
        style={styles.window}
        className={cn(
          'transition-discrete duration-200 ease-out starting:opacity-0',
          isOpen ? 'flex opacity-100' : 'hidden opacity-0',
        )}
      >
        <div style={styles.titleBar}>
          <span style={styles.titleText}>DevConsole</span>
          <button
            type="button"
            style={styles.minimizeButton}
            onClick={() => setIsOpen(false)}
            aria-label="Minimize dev console"
          >
            {'–'}
          </button>
        </div>
        <div style={styles.logList} ref={logListRef}>
          {logs.map((entry) => (
            <div
              key={entry.id}
              style={{ ...styles.logLine, color: colorByKind[entry.kind] }}
            >
              {prefixByKind[entry.kind]
                ? `${prefixByKind[entry.kind]} ${entry.text}`
                : entry.text}
            </div>
          ))}
        </div>
        <div style={styles.inputRow}>
          <span style={styles.prompt}>{'>'}</span>
          <input
            name="dev-console-input"
            style={styles.input}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter JS…"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </>
  );
}
