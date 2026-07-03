import type { BotErrorLogLevel } from '@marquinhos/types';

export interface ErrorHistoryEntry {
  timestamp: Date;
  origin: string;
  logLevel: BotErrorLogLevel;
  message: string;
}

const MAX_ENTRIES = 20;
const history: ErrorHistoryEntry[] = [];

export function recordError(entry: ErrorHistoryEntry): void {
  history.push(entry);
  if (history.length > MAX_ENTRIES) {
    history.shift();
  }
}

export function getRecentErrors(
  windowMs: number = 15 * 60 * 1000,
): ErrorHistoryEntry[] {
  const cutoff = Date.now() - windowMs;
  return history.filter((entry) => entry.timestamp.getTime() >= cutoff);
}

export function _resetErrorHistoryForTests(): void {
  history.length = 0;
}
