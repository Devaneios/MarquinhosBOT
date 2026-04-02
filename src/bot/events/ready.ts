import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { BotEvent } from '@marquinhos/types';
import { getBicho } from '@marquinhos/utils/bichoGame';
import { logger } from '@marquinhos/utils/logger';
import { Client, TextChannel } from 'discord.js';

const api = MarquinhosApiService.getInstance();

/** Tracked intervals — cleared on shutdown via GameManager.destroy() chain */
const intervalHandles: ReturnType<typeof setInterval>[] = [];

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
  intervalHandles.push(
    setInterval(() => {
      client.user?.setActivity(getBicho());
    }, 100 * 1000),
  );
}

/** Returns milliseconds until next midnight in Recife time (America/Recife). */
function msUntilMidnightRecife(): number {
  const now = new Date();
  // Build a formatter that gives us the Recife hour/minute/second
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Recife',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })
    .formatToParts(now)
    .reduce(
      (acc, p) => {
        if (p.type === 'hour') acc.hour = Number(p.value);
        if (p.type === 'minute') acc.minute = Number(p.value);
        if (p.type === 'second') acc.second = Number(p.value);
        return acc;
      },
      { hour: 0, minute: 0, second: 0 },
    );

  const msElapsedToday =
    parts.hour * 3_600_000 + parts.minute * 60_000 + parts.second * 1_000;
  const msInDay = 24 * 3_600_000;
  return msInDay - msElapsedToday;
}

async function rotateTermoWord(client: Client): Promise<void> {
  try {
    const guilds = client.guilds.cache;

    for (const [guildId] of guilds) {
      try {
        const cfgRes = await api.getWordleConfig(guildId);
        const channelId = (cfgRes.data as { channelId?: string })?.channelId;
        if (!channelId) continue;

        const result = await api.forceNewWordleWord(guildId);
        const data = result.data as { wordLength: number };

        const channel = client.channels.cache.get(channelId) as
          | TextChannel
          | undefined;
        if (!channel) continue;

        const shortTrashTalks = [
          'boa sorte (vão precisar).',
          'duvido acertarem.',
          'quero só ver o desespero.',
          'valendo a dignidade.',
          'vão chutar até amanhã.',
          'essa vai dar trabalho.',
          'desistir é uma opção.',
          'ninguém vai acertar essa.',
          'hoje não é o dia de vocês.',
          'já podem ir desistindo.',
          'nem tentem.',
          'essa tá fácil... pra mim.',
          'quem vai se humilhar primeiro?',
          'essa palavra não é pra qualquer um.',
          'alguém aqui sabe português?',
          'podem errar à vontade.',
          'vão sofrer muito hoje.',
          'esperando o primeiro erro.',
          'hoje tem humilhação gratuita.',
          'vão reclamar que a palavra é injusta.',
          'podem começar a chorar agora.',
          'vocês não estão prontos.',
          'hoje a palavra vence.',
          'muito vocabulário pra pouca gente.',
          'spoiler: não vão acertar.',
        ];
        const trashTalk =
          shortTrashTalks[Math.floor(Math.random() * shortTrashTalks.length)];
        await channel.send(
          `<@&1487639231361978399> **Nova palavra!** (${data.wordLength} letras) — ${trashTalk}\n` +
            `${'⬜'.repeat(data.wordLength)}`,
        );
      } catch (err) {
        logger.warn(`Termo: failed to rotate word for guild ${guildId}:`, err);
      }
    }
  } catch (err) {
    logger.error('Erro ao rotacionar palavra do Termo:', err);
  }
}

function startTermoScheduler(client: Client): void {
  const msToMidnight = msUntilMidnightRecife();
  logger.info(
    `Termo: próxima palavra em ${Math.round(msToMidnight / 60000)} minutos`,
  );

  setTimeout(() => {
    rotateTermoWord(client);
    intervalHandles.push(
      setInterval(() => rotateTermoWord(client), 24 * 60 * 60 * 1000),
    );
  }, msToMidnight);
}

const lastBroadcastWinners = new Map<string, number>();

async function broadcastTermoStats(client: Client): Promise<void> {
  const guilds = client.guilds.cache;

  for (const [guildId] of guilds) {
    try {
      const cfgRes = await api.getWordleConfig(guildId);
      const channelId = (cfgRes.data as { channelId?: string })?.channelId;
      if (!channelId) continue;

      const statsRes = await api.getWordleStats(guildId);
      const stats = statsRes.data as {
        playersCount: number;
        winnersCount: number;
        avgAttempts: number;
      };

      if (
        !stats ||
        stats.winnersCount <= (lastBroadcastWinners.get(guildId) ?? 0)
      )
        continue;

      const channel = client.channels.cache.get(channelId) as
        | TextChannel
        | undefined;
      if (!channel) continue;

      await channel.send(
        `**Termo — Hoje:** ${stats.playersCount} pessoa${stats.playersCount !== 1 ? 's' : ''} jogaram, ` +
          `${stats.winnersCount} acertaram, ` +
          `média de ${stats.avgAttempts} tentativa${stats.avgAttempts !== 1 ? 's' : ''}.`,
      );
      lastBroadcastWinners.set(guildId, stats.winnersCount);
    } catch (err) {
      logger.warn(`Termo stats: failed for guild ${guildId}:`, err);
    }
  }
}

function startTermoStatsBroadcast(client: Client): void {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  intervalHandles.push(
    setInterval(() => broadcastTermoStats(client), TWO_HOURS),
  );
}
