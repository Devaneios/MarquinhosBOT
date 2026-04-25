import { GuildConfig } from '@marquinhos/config/guild';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { buildWordHiddenPreviewImage } from '@marquinhos/ui/screens/termo';
import { getBicho } from '@marquinhos/utils/bichoGame';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { Listener } from '@sapphire/framework';
import {
  AttachmentBuilder,
  Client,
  EmbedBuilder,
  Events,
  TextChannel,
} from 'discord.js';

const api = MarquinhosApiService.getInstance();

export class ReadyListener extends Listener<typeof Events.ClientReady> {
  public constructor(context: Listener.LoaderContext) {
    super(context, { event: Events.ClientReady, once: true });
  }

  override async run(client: Client<true>) {
    logger.info(`Logged in as ${client.user.tag}`);
    logger.info('Marquinhos™ is online!');
    startBichoGame(client);
    startTermoScheduler(client);
    startTermoStatsBroadcast(client);
  }
}

function startBichoGame(client: Client<true>) {
  client.user.setActivity(getBicho());
  setInterval(() => {
    client.user.setActivity(getBicho());
  }, 100 * 1000);
}

function msUntilMidnightRecife(): number {
  const now = new Date();
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

async function rotateTermoWord(client: Client<true>): Promise<void> {
  try {
    const guilds = client.guilds.cache;

    for (const [guildId] of guilds) {
      try {
        const cfgRes = await api.getWordleConfig(guildId);
        const channelId = (cfgRes.data as { channelId?: string })?.channelId;
        if (!channelId) continue;

        const result = await api.forceNewWordleWord(guildId);
        const data = result.data as { wordLength: number; wordDate?: string };

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

        const previewBuffer = await buildWordHiddenPreviewImage(
          data.wordLength,
        );
        const previewAttachment = new AttachmentBuilder(previewBuffer, {
          name: 'nova-palavra.png',
        });

        const embed = baseEmbed(client)
          .setTitle(`Novo Terminho - ${data.wordLength} letras`)
          .setDescription(trashTalk)
          .setColor(0x588157)
          .setImage('attachment://nova-palavra.png');

        await channel.send({
          content: `<@&${GuildConfig.TERMINHOS_ANNOUNCE_ROLE_ID}>`,
          embeds: [embed],
          files: [previewAttachment],
        });
      } catch (err) {
        logger.warn(
          `Terminhos: failed to rotate word for guild ${guildId}:`,
          err,
        );
      }
    }
  } catch (err) {
    logger.error('Erro ao rotacionar palavra do Terminhos:', err);
  }
}

function startTermoScheduler(client: Client<true>): void {
  const msToMidnight = msUntilMidnightRecife();
  logger.info(
    `Terminhos: próxima palavra em ${Math.round(msToMidnight / 60000)} minutos`,
  );

  setTimeout(() => {
    rotateTermoWord(client);
    setInterval(() => rotateTermoWord(client), 24 * 60 * 60 * 1000);
  }, msToMidnight);
}

const lastBroadcastWinners = new Map<string, number>();

async function broadcastTermoStats(client: Client<true>): Promise<void> {
  const guilds = client.guilds.cache;

  for (const [guildId] of guilds) {
    try {
      const cfgRes = await api.getWordleConfig(guildId);
      const channelId = (cfgRes.data as { channelId?: string })?.channelId;
      if (!channelId) continue;

      const statsRes = await api.getWordleStats(guildId);
      const stats = statsRes.data as {
        wordDate?: string;
        playersCount: number;
        winnersCount: number;
        avgAttempts: number;
        wordLength: number;
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

      const embed = new EmbedBuilder()
        .setTitle('Status do Termo')
        .addFields(
          {
            name: 'Jogadores',
            value: String(stats.playersCount),
            inline: true,
          },
          { name: 'Acertos', value: String(stats.winnersCount), inline: true },
          { name: 'Média', value: stats.avgAttempts.toFixed(1), inline: true },
          { name: 'Letras', value: String(stats.wordLength), inline: true },
        )
        .setColor(0x588157);
      if (stats.wordDate) {
        embed.setFooter({
          text: stats.wordDate.split('-').reverse().join('/'),
        });
      }
      await channel.send({ embeds: [embed] });
      lastBroadcastWinners.set(guildId, stats.winnersCount);
    } catch (err) {
      logger.warn(`Terminhos stats: failed for guild ${guildId}:`, err);
    }
  }
}

function startTermoStatsBroadcast(client: Client<true>): void {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  setInterval(() => broadcastTermoStats(client), TWO_HOURS);
}
