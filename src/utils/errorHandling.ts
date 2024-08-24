import { logger } from '@utils/logger';
import BotError from '@utils/botError';
import { Client, TextChannel } from 'discord.js';

export const safeExecute = (fn: Function, client: Client) => {
  return function () {
    fn()?.catch((error: BotError) => commandErrorHandler(error, client));
  };
};

const commandErrorHandler = async (error: BotError, client: Client) => {
  switch (error.logLevel) {
    case 'warn':
      logger.warn(`${error} while running ${error.discordMessage}`);
      break;
    case 'info':
      logger.info(`${error} while running ${error.discordMessage}`);
      break;
    default:
      try {
        const errorStackTraceChunks = error.stack?.match(/.{1,2048}/gs);
        if (!errorStackTraceChunks?.length) {
          await sendErrorMessage(
            client,
            error.message,
            'No stack trace available'
          );
        } else if (errorStackTraceChunks.length === 1) {
          await sendErrorMessage(
            client,
            error.message,
            errorStackTraceChunks[0]
          );
        } else {
          for (const [index, chunk] of errorStackTraceChunks.entries()) {
            await sendErrorMessage(
              client,
              `${error.message} ${index + 1}/${errorStackTraceChunks.length}`,
              chunk
            );
          }
        }
      } catch (error: any) {
        logger.error(
          `Error while trying to send error message to error channel\n${error.stack}`
        );
      }
      logger.error(
        `${error} while running ${error.discordMessage}\n${error.stack} `
      );
      break;
  }
};

async function sendErrorMessage(
  client: Client,
  title: string,
  description: string
) {
  await (
    client.channels.cache.get(process.env.ERROR_CHANNEL_ID || '') as TextChannel
  )?.send(`### ⚠️⚠️⚠️ ${title} ⚠️⚠️⚠️\n\n\`\`\`ansi\n[2;31m${description}[0m\`\`\``);
}
