import { SapphireClient } from '@sapphire/framework';
import '@sapphire/plugin-logger/register';
import { GatewayIntentBits, Partials } from 'discord.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/environment';
import { GameManager } from './game/core/GameManager';
import { initializePlayer } from './lib/player';
import { registerSapphirePieces } from './lib/registerSapphirePieces';
import { stopReadySchedulers } from './listeners/ready';
import { MarquinhosApiService } from './services/marquinhosApi';
import { SpreadsheetService } from './services/spreadsheet';
import {
  flushPendingErrors,
  reportError,
  setDiscordClient,
} from './utils/errorHandling';
import { logger } from './utils/logger';

process.env.ROOT_DIR = dirname(fileURLToPath(import.meta.url));

function flushWithTimeout(ms = 2000): Promise<unknown> {
  return Promise.race([
    flushPendingErrors(),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  reportError(reason, {
    origin: 'process.unhandledRejection',
    logLevel: 'error',
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught exception: ${error.message}\n${error.stack}`);
  reportError(error, {
    origin: 'process.uncaughtException',
    logLevel: 'error',
  });
  flushWithTimeout().finally(() => process.exit(1));
});

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
  baseUserDirectory: null,
  loadMessageCommandListeners: false,
});

client.on('error', (error) => {
  logger.error('Discord client error:', error);
  reportError(error, { origin: 'discord.client.error', logLevel: 'error' });
});

client.on('shardError', (error, shardId) => {
  logger.error(`Discord shard ${shardId} error:`, error);
  reportError(error, {
    origin: `discord.shardError:${shardId}`,
    logLevel: 'error',
  });
});

client.on('shardDisconnect', (event, shardId) => {
  logger.warn(
    `Discord shard ${shardId} disconnected (code ${event.code}, reason: ${event.reason || 'none'})`,
  );
});

const healthServer = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.HEALTHCHECK_PORT ?? 3001),
  fetch() {
    return new Response(client.isReady() ? 'ok\n' : 'not ready\n', {
      status: client.isReady() ? 200 : 503,
    });
  },
});

function registerShutdownHooks() {
  let shuttingDown = false;
  const cleanup = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down gracefully...');
    stopReadySchedulers();
    healthServer.stop(true);
    GameManager.getInstance().destroy();
    flushWithTimeout()
      .catch(() => undefined)
      .finally(() => {
        client.destroy();
        process.exit(0);
      });
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

async function main() {
  try {
    logger.info('Starting Marquinhos™ with Sapphire...');
    await registerSapphirePieces();
    await initializePlayer(client);
    registerShutdownHooks();
    SpreadsheetService.getInstance();
    await client.login(env.MARQUINHOS_TOKEN);
    setDiscordClient(client);
    try {
      const api = MarquinhosApiService.getInstance();
      const { data } = await api.getWordlistPoolStats();
      logger.info(
        `Termo wordlist: ${data.remaining} palavras restantes de ${data.total} (${data.used} já usadas)`,
      );
    } catch {
      logger.warn('Não foi possível obter stats do wordlist do termo.');
    }
  } catch (error) {
    logger.error('Failed to start Marquinhos:', error);
    process.exit(1);
  }
}

main();
