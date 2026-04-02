import BotError from '@marquinhos/utils/botError';
import { logger } from '@marquinhos/utils/logger';

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

const commandErrorHandler = async (error: BotError) => {
  queueErrorForWebhook(error);
  switch (error.logLevel) {
    case 'warn':
      logger.warn(`${error?.stack ?? error.message}`);
      break;
    case 'info':
      logger.info(`${error?.stack ?? error.message}`);
      break;
    default:
      logger.error(`${error?.stack ?? error.message}`);
      break;
  }
};

// --- Webhook error batching (flush at most once per 5s) ---
const ERROR_FLUSH_INTERVAL_MS = 5000;
const pendingErrors: BotError[] = [];
let flushTimer: NodeJS.Timeout | null = null;

function queueErrorForWebhook(error: BotError): void {
  pendingErrors.push(error);
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const batch = pendingErrors.splice(0);
      if (batch.length > 0) {
        sendErrorBatch(batch);
      }
    }, ERROR_FLUSH_INTERVAL_MS);
  }
}

async function sendErrorBatch(errors: BotError[]): Promise<void> {
  const webhookUrl = process.env.MARQUINHOS_ERROR_WEBHOOK;
  if (!webhookUrl) return;

  // Cap embeds to 10 per message (Discord limit)
  const embeds = errors.slice(0, 10).map((error) => {
    const title = error.message;
    const description = error?.stack || 'No stack trace';
    return {
      title: 'Search error on StackOverflow',
      url: `https://www.google.com/search?q=${encodeURIComponent(
        title,
      )}%20site:stackoverflow.com`,
      description: `\`\`\`${description.slice(0, 1024)}\`\`\``,
      color: 0xff0000,
      footer: {
        text: 'The operation has failed successfully!',
      },
      fields: [
        {
          name: 'Level',
          value: error.logLevel || 'error',
          inline: true,
        },
        {
          name: 'Origin',
          value: error.origin || 'Unknown',
          inline: true,
        },
      ],
    };
  });

  if (errors.length > 10) {
    embeds.push({
      title: `... and ${errors.length - 10} more errors`,
      url: '',
      description: '',
      color: 0xff0000,
      footer: { text: '' },
      fields: [],
    });
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Marquinhos Error Notifier',
        avatar_url: 'https://i.imgur.com/M4k2OVe.png',
        embeds,
      }),
    });
  } catch (error) {
    logger.error('Failed to send error webhook:', error);
  }
}
