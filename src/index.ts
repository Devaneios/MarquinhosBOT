import { MarquinhosBot } from '@marquinhos/bot/marquinhos-bot';
import { config } from 'dotenv';
import { safeExecute } from './utils/errorHandling';
import { logger } from './utils/logger';

process.env.ROOT_DIR = __dirname;
config();

// Global handlers so unhandled rejections/exceptions are logged before process exit
// rather than silently crashing (Node 15+ exits on unhandled rejections)
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught exception: ${error.message}\n${error.stack}`);
  // Do not continue running — process state is undefined after an uncaughtException
  process.exit(1);
});

const marquinhos = new MarquinhosBot();

safeExecute(marquinhos.start.bind(marquinhos))();
