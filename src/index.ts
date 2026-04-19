import { SapphireClient } from '@sapphire/framework';
import '@sapphire/plugin-logger/register';
import { GatewayIntentBits, Partials } from 'discord.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/environment';
import { GameManager } from './game/core/GameManager';
import { initializePlayer } from './lib/player';
import { registerSapphirePieces } from './lib/registerSapphirePieces';
import { SpreadsheetService } from './services/spreadsheet';
import { logger } from './utils/logger';

process.env.ROOT_DIR = dirname(fileURLToPath(import.meta.url));

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught exception: ${error.message}\n${error.stack}`);
  process.exit(1);
});

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
  baseUserDirectory: null,
  loadMessageCommandListeners: false,
});

registerSapphirePieces();

function registerShutdownHooks() {
  const cleanup = () => {
    logger.info('Shutting down gracefully...');
    GameManager.getInstance().destroy();
    client.destroy();
    process.exit(0);
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

async function main() {
  try {
    logger.info('Starting Marquinhos™ with Sapphire...');
    await initializePlayer(client);
    registerShutdownHooks();
    SpreadsheetService.getInstance();
    await client.login(env.MARQUINHOS_TOKEN);
  } catch (error) {
    logger.error('Failed to start Marquinhos:', error);
    process.exit(1);
  }
}

main();
