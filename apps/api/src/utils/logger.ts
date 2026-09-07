export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type LogFields = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const DEFAULT_LEVEL: LogLevel = 'info';

function currentLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (configured && configured in LEVEL_PRIORITY) {
    return configured as LogLevel;
  }
  return DEFAULT_LEVEL;
}

export function isLevelEnabled(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[currentLevel()];
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack };
  }
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function serialize(level: LogLevel, event: string, fields: LogFields): string {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  try {
    return JSON.stringify(payload, replacer);
  } catch (error) {
    return JSON.stringify({
      ts: payload.ts,
      level,
      event,
      serializationError: (error as Error).message,
    });
  }
}

export function log(level: LogLevel, event: string, fields: LogFields = {}) {
  if (!isLevelEnabled(level)) return;
  const line = serialize(level, event, fields);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  error: (event: string, fields?: LogFields) => log('error', event, fields),
  warn: (event: string, fields?: LogFields) => log('warn', event, fields),
  info: (event: string, fields?: LogFields) => log('info', event, fields),
  debug: (event: string, fields?: LogFields) => log('debug', event, fields),
};
