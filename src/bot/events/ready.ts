import { BotEvent } from '@marquinhos/types';
import { getBicho } from '@marquinhos/utils/bichoGame';
import { logger } from '@marquinhos/utils/logger';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { Client, TextChannel } from 'discord.js';

const api = new MarquinhosApiService();

export const ready: BotEvent = {
  name: 'ready',
  once: true,
  execute: async (client: Client) => {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info('Marquinhos™ is online!');
    startBichoGame(client);
    startTermoScheduler(client);
    startTermoStatsBroadcast(client);
  },
};

function startBichoGame(client: Client) {
  client.user?.setActivity(getBicho());
  setInterval(() => {
    client.user?.setActivity(getBicho());
  }, 100 * 1000);
}

/** Returns milliseconds until next midnight in Recife time (UTC-3). */
function msUntilMidnightRecife(): number {
  const now = new Date();
  // Current time in Recife (UTC-3)
  const recifeOffset = -3 * 60; // minutes
  const localOffset = now.getTimezoneOffset(); // minutes (positive = behind UTC)
  const diffMin = recifeOffset - -localOffset;
  const recifeNow = new Date(now.getTime() + diffMin * 60 * 1000);

  const nextMidnight = new Date(recifeNow);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime() - recifeNow.getTime();
}

async function rotateTermoWord(client: Client): Promise<void> {
  try {
    const guilds = client.guilds.cache;

    for (const [guildId] of guilds) {
      try {
        const cfgRes = await api.getWordleConfig(guildId);
        const channelId = (cfgRes.data as any)?.channelId;
        if (!channelId) continue;

        const result = await api.forceNewWordleWord(guildId);
        const data = result.data as any;

        const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
        if (!channel) continue;

        await channel.send(
          `🟩 **Nova palavra do Termo!** (${data.wordLength} letras) — boa sorte a todos!\n` +
          `${'⬜'.repeat(data.wordLength)}`,
        );
      } catch {
        // Skip guilds with errors
      }
    }
  } catch (err) {
    logger.error('Erro ao rotacionar palavra do Termo:', err);
  }
}

function startTermoScheduler(client: Client): void {
  const msToMidnight = msUntilMidnightRecife();
  logger.info(`Termo: próxima palavra em ${Math.round(msToMidnight / 60000)} minutos`);

  setTimeout(() => {
    rotateTermoWord(client);
    setInterval(() => rotateTermoWord(client), 24 * 60 * 60 * 1000);
  }, msToMidnight);
}

const lastBroadcastWinners = new Map<string, number>();

async function broadcastTermoStats(client: Client): Promise<void> {
  const guilds = client.guilds.cache;

  for (const [guildId] of guilds) {
    try {
      const cfgRes = await api.getWordleConfig(guildId);
      const channelId = (cfgRes.data as any)?.channelId;
      if (!channelId) continue;

      const statsRes = await api.getWordleStats(guildId);
      const stats = statsRes.data as any;

      if (!stats || stats.winnersCount <= (lastBroadcastWinners.get(guildId) ?? 0)) continue;

      const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
      if (!channel) continue;

      await channel.send(
        `📊 **Termo — Hoje:** ${stats.playersCount} pessoa${stats.playersCount !== 1 ? 's' : ''} jogaram, ` +
        `${stats.winnersCount} acertaram, ` +
        `média de ${stats.avgAttempts} tentativa${stats.avgAttempts !== 1 ? 's' : ''}.`,
      );
      lastBroadcastWinners.set(guildId, stats.winnersCount);
    } catch {
      // Skip guilds with errors
    }
  }
}

function startTermoStatsBroadcast(client: Client): void {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  setInterval(() => broadcastTermoStats(client), TWO_HOURS);
}
