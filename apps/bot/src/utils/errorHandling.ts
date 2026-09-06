import { env } from '@marquinhos/config/environment';
import type { BotErrorLogLevel } from '@marquinhos/types';
import BotError from '@marquinhos/utils/botError';
import { recordError } from '@marquinhos/utils/errorHistory';
import { logger } from '@marquinhos/utils/logger';
import type { Client } from 'discord.js';

/**
 * Wraps a function so that both synchronous throws and async rejections
 * are routed through the error handler.
 *
 * **Usage:** callers MUST use `.bind()` or closures to forward arguments,
 * since the returned wrapper is invoked with no arguments.
 */
export function safeExecute(fn: Function) {
  return function () {
    try {
      const result = fn();
      if (result instanceof Promise) {
        result.catch((error: BotError) => {
          commandErrorHandler(error);
        });
      }
    } catch (error) {
      commandErrorHandler(error as BotError);
    }
  };
}

const commandErrorHandler = (error: BotError) => {
  reportError(error, {
    origin: error.origin ?? 'Unknown',
    logLevel: error.logLevel,
  });
};

export interface ReportErrorOptions {
  origin: string;
  logLevel?: BotErrorLogLevel;
}

/**
 * Routes an error from anywhere in the app — not just command handlers —
 * to the console logger, the in-memory error history ring buffer, and the
 * batched admin DM queue.
 */
export function reportError(error: unknown, options: ReportErrorOptions): void {
  const err = error as { stack?: string; message?: string };
  const logLevel = options.logLevel ?? 'error';
  const message = err?.message ?? String(error);
  const text = err?.stack ?? message;

  switch (logLevel) {
    case 'warn':
      logger.warn(text);
      break;
    case 'info':
      logger.info(text);
      break;
    default:
      logger.error(text);
      break;
  }

  recordError({
    timestamp: new Date(),
    origin: options.origin,
    logLevel,
    message,
  });

  queueErrorForDM({
    message,
    stack: err?.stack,
    logLevel,
    origin: options.origin,
  });
}

// --- Discord DM error batching (flush at most once per 5s) ---

interface QueuedError {
  message: string;
  stack?: string;
  logLevel: BotErrorLogLevel;
  origin: string;
}

const ERROR_FLUSH_INTERVAL_MS = 5000;
let pendingErrors: QueuedError[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let discordClient: Client | null = null;

export function setDiscordClient(client: Client | null): void {
  discordClient = client;
}

function queueErrorForDM(error: QueuedError): void {
  pendingErrors.push(error);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPendingErrors();
  }, ERROR_FLUSH_INTERVAL_MS);
}

/**
 * Sends the queued batch as a DM. On success the queue is cleared; on any
 * failure (client not ready, DM closed, etc.) the batch is left queued so
 * the next flush retries it, and the failure is logged to console instead.
 */
export async function flushPendingErrors(): Promise<void> {
  if (pendingErrors.length === 0) return;

  const userId = env.MARQUINHOS_ERROR_DM_USER_ID;
  if (!userId) {
    pendingErrors = [];
    return;
  }

  if (!discordClient) {
    logger.error(
      `Cannot deliver ${pendingErrors.length} queued error(s): Discord client not ready yet. Will retry.`,
    );
    scheduleFlush();
    return;
  }

  const batch = pendingErrors.slice(0, 10);
  const embeds = batch.map((error) => ({
    title: error.message.slice(0, 256),
    description: `\`\`\`${(error.stack ?? 'No stack trace').slice(0, 1024)}\`\`\``,
    color: 0xff0000,
    fields: [
      { name: 'Level', value: error.logLevel, inline: true },
      { name: 'Origin', value: error.origin, inline: true },
    ],
  }));

  if (pendingErrors.length > 10) {
    embeds.push({
      title: `... and ${pendingErrors.length - 10} more errors`,
      description: '',
      color: 0xff0000,
      fields: [],
    });
  }

  try {
    const user = await discordClient.users.fetch(userId);
    await user.send({ embeds });
    pendingErrors = [];
  } catch (error) {
    logger.error(`Failed to DM error batch: ${error}`);
    scheduleFlush();
  }
}

export function _resetErrorHandlingForTests(): void {
  pendingErrors = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  discordClient = null;
}
