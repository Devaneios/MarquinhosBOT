import BotError from '@marquinhos/utils/botError';
import { logger } from '@marquinhos/utils/logger';
import axios from 'axios';

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
  await sendErrorMessage(error);
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

async function sendErrorMessage(error: BotError) {
  const title = error.message;
  const description = error?.stack || 'No stack trace';

  try {
    await axios.post(
      encodeURI(process.env.MARQUINHOS_ERROR_WEBHOOK || ''),
      {
        username: 'Marquinhos Error Notifier',
        avatar_url: 'https://i.imgur.com/M4k2OVe.png',
        embeds: [
          {
            title: `Search error on StackOverflow`,
            url: `https://www.google.com/search?q=${encodeURI(
              title
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
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error(error);
  }
}
