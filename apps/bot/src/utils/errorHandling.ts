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
        result.catch((error: unknown) => {
          commandErrorHandler(error);
        });
      }
    } catch (error) {
      commandErrorHandler(error);
    }
  };
}

const commandErrorHandler = (error: unknown) => {
  reportError(error, {
    origin: error instanceof BotError ? error.origin : 'Unknown',
    logLevel: error instanceof BotError ? error.logLevel : undefined,
  });
};

/**
 * Extracts a readable message from a value caught by a `catch` block,
 * which TypeScript types as `unknown` and may not even be an `Error`.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
  const logLevel = options.logLevel ?? 'error';
  const message = getErrorMessage(error);
  const text = error instanceof Error ? (error.stack ?? message) : message;

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
    stack: error instanceof Error ? error.stack : undefined,
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

// While DMs keep failing the queue would otherwise grow without bound.
const MAX_QUEUED_ERRORS = 100;

function queueErrorForDM(error: QueuedError): void {
  pendingErrors.push(error);
  if (pendingErrors.length > MAX_QUEUED_ERRORS) {
    pendingErrors = pendingErrors.slice(-MAX_QUEUED_ERRORS);
  }
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
 * Sends the queued batch as a DM. On success the errors it covered (shown
 * or counted) leave the queue; on any failure (client not ready, DM closed,
 * etc.) the batch is left queued so the next flush retries it, and the
 * failure is logged to console instead.
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

  const covered = new Set(pendingErrors);
  const embeds = batchEmbeds(pendingErrors);

  try {
    const user = await discordClient.users.fetch(userId);
    await user.send({ embeds });
    // Errors reported while the DM was in flight wait for the next flush.
    pendingErrors = pendingErrors.filter((error) => !covered.has(error));
  } catch (error) {
    logger.error(`Failed to DM error batch: ${error}`);
    scheduleFlush();
  }
}

// Discord rejects a message with more than 10 embeds or 6000 characters
// across them; a rejected batch would stay queued and be retried forever.
const MAX_EMBEDS_PER_MESSAGE = 10;
const MAX_MESSAGE_CHARS = 6000;
const SUMMARY_RESERVE_CHARS = 64;

interface ErrorEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
}

function toEmbed(error: QueuedError): ErrorEmbed {
  return {
    title: error.message.slice(0, 256),
    description: `\`\`\`${(error.stack ?? 'No stack trace').slice(0, 1024)}\`\`\``,
    color: 0xff0000,
    fields: [
      { name: 'Level', value: error.logLevel, inline: true },
      { name: 'Origin', value: error.origin.slice(0, 1024), inline: true },
    ],
  };
}

function embedChars(embed: ErrorEmbed): number {
  return (
    embed.title.length +
    embed.description.length +
    embed.fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0)
  );
}

// Shows as many errors in full as fit, then one embed counting the rest.
function batchEmbeds(errors: QueuedError[]): ErrorEmbed[] {
  const embeds: ErrorEmbed[] = [];
  let chars = 0;
  for (const error of errors) {
    const embed = toEmbed(error);
    const fits =
      embeds.length < MAX_EMBEDS_PER_MESSAGE - 1 &&
      chars + embedChars(embed) <= MAX_MESSAGE_CHARS - SUMMARY_RESERVE_CHARS;
    if (!fits) break;
    embeds.push(embed);
    chars += embedChars(embed);
  }
  const summarized = errors.length - embeds.length;
  if (summarized > 0) {
    embeds.push({
      title: `... and ${summarized} more errors`,
      description: '',
      color: 0xff0000,
      fields: [],
    });
  }
  return embeds;
}

export function _resetErrorHandlingForTests(): void {
  pendingErrors = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  discordClient = null;
}
