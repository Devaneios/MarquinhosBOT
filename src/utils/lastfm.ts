import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Message,
} from 'discord.js';

import { MarquinhosApiService } from 'src/services/marquinhosApi';
import { TempoDataProvider } from 'src/utils/tempo';
import { logger } from './logger';
import { Track } from 'src/types';

const tempo = new TempoDataProvider();
const marquinhosApi = new MarquinhosApiService();

export const musicBotMessageHandler = async (message: Message) => {
  if (!tempo.isHandleableMessage(message)) return;
  const playbackData = await tempo.getPlaybackDataFromMessage(message);
  if (playbackData) {
    const response = await marquinhosApi.addToScrobbleQueue(playbackData);

    if (!response) {
      logger.error(
        `Couldn't add ${playbackData.title} to scrobble queue. Empty response`
      );
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('Erro ao adicionar a fila de scrobbling :cry:')
            .setDescription(
              `A música **${playbackData.title}** não foi adicionada a fila de scrobbling.`
            )
            .setColor('#FF0000'),
        ],
      });
      return;
    }

    const scrobbleId = response.data.id;
    const track: Track = response.data.track;

    if (!track || !scrobbleId) {
      logger.error(`Couldn't add ${playbackData.title} to scrobble queue`);
      logger.error(`track: ${!!track}, scrobbleId: ${!!scrobbleId}`);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('Erro ao adicionar a fila de scrobbling :cry:')
            .setDescription(
              `A música **${playbackData.title}** não foi adicionada a fila de scrobbling.`
            )
            .setColor('#FF0000'),
        ],
      });
      return;
    }

    const fourMinutesInMillis = 240000;
    const tenSecondsInMillis = 10000;

    const timeUntilScrobbling = Math.min(
      Math.floor(track.durationInMillis / 2),
      fourMinutesInMillis
    );

    const cancelScrobble = new ButtonBuilder()
      .setCustomId('cancel')
      .setLabel('Cancelar pra mim')
      .setEmoji({ name: '❌' })
      .setStyle(ButtonStyle.Secondary);

    const addScrobble = new ButtonBuilder()
      .setCustomId('add')
      .setLabel('Adicionar pra mim')
      .setEmoji({ name: '➕' })
      .setStyle(ButtonStyle.Primary);

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      addScrobble,
      cancelScrobble,
    ]);

    let scrobblesOnUsers: string[] = response.data.scrobblesOnUsers;

    logger.info(
      `Added ${playbackData.title} to scrobble queue to ${scrobblesOnUsers.length} users`
    );

    const scrobbleEmbed = new EmbedBuilder()
      .setTitle('Adicionado a fila de scrobbling :headphones:')
      .setDescription(getOngoingScrobbleDescription(track, scrobblesOnUsers))
      .setThumbnail(track.coverArtUrl)
      .setFooter({
        text: `Scrobbling será feito em ${millisecondsToFormattedText(
          timeUntilScrobbling
        )}`,
      })
      .setColor('#1DB954');

    const scrobbleEmbedRef = await message.channel.send({
      embeds: [scrobbleEmbed],
      components: [buttons],
    });

    let collector = scrobbleEmbedRef.createMessageComponentCollector({
      componentType: ComponentType.Button,
    });

    collector.on('collect', async (collectedInteraction) => {
      if (collectedInteraction.customId === 'add') {
        if (scrobblesOnUsers.includes(collectedInteraction.user.id)) {
          await collectedInteraction.deferUpdate();
          return;
        }
        if (scrobblesOnUsers.length === 0) {
          buttons.setComponents([addScrobble, cancelScrobble]);
        }
        scrobblesOnUsers.push(collectedInteraction.user.id);
        await marquinhosApi.addUserToScrobbleQueue(
          scrobbleId,
          collectedInteraction.user.id
        );
        scrobbleEmbed.setDescription(
          getOngoingScrobbleDescription(track, scrobblesOnUsers)
        );
        await collectedInteraction.deferUpdate();

        await scrobbleEmbedRef.edit({
          embeds: [scrobbleEmbed],
          components: [buttons],
        });
      } else if (collectedInteraction.customId === 'cancel') {
        if (!scrobblesOnUsers.includes(collectedInteraction.user.id)) {
          await collectedInteraction.deferUpdate();
          return;
        }
        scrobblesOnUsers = scrobblesOnUsers.filter(
          (id) => id !== collectedInteraction.user.id
        );
        await marquinhosApi.removeUserFromScrobbleQueue(
          scrobbleId,
          collectedInteraction.user.id
        );
        scrobbleEmbed.setDescription(
          getOngoingScrobbleDescription(track, scrobblesOnUsers)
        );
        await collectedInteraction.deferUpdate();
        if (scrobblesOnUsers.length === 0) {
          buttons.setComponents([addScrobble]);
        }
        await scrobbleEmbedRef.edit({
          embeds: [scrobbleEmbed],
          components: [buttons],
        });
      }
    });

    setTimeout(() => {
      addScrobble.setDisabled(true);
      cancelScrobble.setDisabled(true);
      buttons.setComponents([addScrobble, cancelScrobble]);
      scrobbleEmbed.setFooter({
        text: 'O tempo para adicionar a fila de scrobbling acabou!',
      });
      scrobbleEmbedRef.edit({
        embeds: [scrobbleEmbed],
        components: [buttons],
      });
    }, timeUntilScrobbling - tenSecondsInMillis);

    setTimeout(() => {
      marquinhosApi.dispatchScrobbleQueue(scrobbleId).then(() => {
        scrobbleEmbed.setTitle(`O scrobbling de **${track.name}** terminou!`);
        scrobbleEmbed.setDescription(
          getFinishedScrobbleDescription(track, scrobblesOnUsers)
        );
        scrobbleEmbedRef.edit({
          embeds: [scrobbleEmbed],
          components: [buttons],
        });
      });
    }, timeUntilScrobbling);

    setTimeout(() => {
      scrobbleEmbedRef.delete();
    }, track.durationInMillis);
  }
};

const millisecondsToFormattedText = (milliseconds: number) => {
  const date = new Date(milliseconds);

  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();

  let formattedText = '';

  if (minutes > 0) {
    formattedText += minutes + ' minuto' + (minutes !== 1 ? 's' : '');
  }

  if (seconds > 0) {
    if (minutes > 0) {
      formattedText += ' e ';
    }
    formattedText += seconds + ' segundo' + (seconds !== 1 ? 's' : '');
  }

  return formattedText;
};

const getOngoingScrobbleDescription = (track: Track, users: string[]) => {
  if (users.length === 0) {
    return `A música **${track.name}** está na fila de scrobbling, mas não será feito para nenhum usuário.
    Clique em **Adicionar pra mim** para adicionar a fila de scrobbling para você.
      `;
  } else {
    return `A música **${
      track.name
    }** foi adicionada a fila de scrobbling para os seguintes usuários:\n
      ${users.map((id) => `<@${id}>`).join('\n')}
      `;
  }
};

const getFinishedScrobbleDescription = (track: Track, users: string[]) => {
  if (users.length === 0) {
    return `O scrobble da música **${track.name}** terminou, mas não foi feito para nenhum usuário.`;
  } else {
    return `O scrobble da música **${
      track.name
    }** foi feito com sucesso para os seguintes usuários:\n
      ${users.map((id) => `<@${id}>`).join('\n')}
      `;
  }
};
