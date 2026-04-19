import { env } from '@marquinhos/config/environment';
import { baseEmbed, sendTimedMessage } from '@marquinhos/utils/discord';
import { safeExecute } from '@marquinhos/utils/errorHandling';
import { logger } from '@marquinhos/utils/logger';
import { SapphireClient } from '@sapphire/framework';
import { GuildQueue, Player, Track } from 'discord-player';
import {
  DeezerExtractor,
  DeezerExtractorOptions,
  NodeDecryptor,
} from 'discord-player-deezer';
import {
  GuildVoiceChannelResolvable,
  TextChannel,
  VoiceBasedChannel,
} from 'discord.js';

export async function initializePlayer(client: SapphireClient) {
  const player = new Player(client, {
    skipFFmpeg: true,
  });
  let timers: NodeJS.Timeout[] = [];

  const clearTimers = () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers = [];
  };

  const handlePlayStart = async (queue: GuildQueue, track: Track) => {
    const { interactionChannel, addedBy } = queue.metadata as {
      interactionChannel: TextChannel;
      voiceChannel: VoiceBasedChannel;
      addedBy: string;
    };

    clearTimers();

    const playerEmbed = baseEmbed(player.client)
      .setTitle('Tocando agora')
      .setDescription(`[${track.title}](${track.url})`)
      .addFields(
        {
          name: 'Autor',
          value: track.author,
          inline: true,
        },
        {
          name: 'Duração',
          value: track.duration,
          inline: true,
        },
        {
          name: 'Adicionado por',
          value: `<@${addedBy}>`,
        },
      )
      .setThumbnail(track.thumbnail);

    sendTimedMessage(
      { embeds: [playerEmbed] },
      interactionChannel,
      track.durationMS,
    );
  };

  player.events.on('playerStart', (queue: GuildQueue, track: Track) =>
    safeExecute(handlePlayStart.bind(null, queue, track))(),
  );

  player.events.on('playerFinish', () => clearTimers());
  player.events.on('emptyQueue', () => clearTimers());

  player.events.on('playerError', (queue: GuildQueue, error: Error) => {
    logger.error(`Error in player: ${error.message}`);
    const { interactionChannel } = queue.metadata as {
      interactionChannel: TextChannel;
    };
    interactionChannel?.send(
      '❌ Não foi possível reproduzir esta faixa. Tente novamente.',
    );
  });

  player.events.on('audioTrackAdd', (queue, track) => {
    const { interactionChannel, addedBy } = queue.metadata as {
      interactionChannel: TextChannel;
      voiceChannel: GuildVoiceChannelResolvable;
      addedBy: string;
    };

    if (queue.size > 0) {
      const playerEmbed = baseEmbed(player.client)
        .setTitle('Adicionada a fila')
        .setDescription(`[${track.title}](${track.url})`)
        .addFields(
          {
            name: 'Autor',
            value: track.author,
            inline: true,
          },
          {
            name: 'Duração',
            value: track.duration,
            inline: true,
          },
          {
            name: 'Adicionado por',
            value: `<@${addedBy}>`,
          },
        )
        .setThumbnail(track.thumbnail);

      interactionChannel.send({
        embeds: [playerEmbed],
      });
    }
  });

  await player.extractors.register(DeezerExtractor, {
    decryptionKey: env.MARQUINHOS_DECRYPTION_KEY,
    arl: env.DEEZER_ARL_COOKIE,
    decryptor: NodeDecryptor,
  } as unknown as DeezerExtractorOptions);
}
