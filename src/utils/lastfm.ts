import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
} from 'discord.js';
import { MarquinhosApiService } from 'src/services/marquinhosApi';
import { TempoDataProvider } from 'src/services/tempo';
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
    let scrobblesOnUsers: string[] = response.data.scrobblesOnUsers;

    if (!scrobblesOnUsers || !track || !scrobbleId) {
      logger.error(`Couldn't add ${playbackData.title} to scrobble queue`);
      logger.error(
        `scrobblesOnUsers: ${!!scrobblesOnUsers}, track: ${!!track}, scrobbleId: ${!!scrobbleId}`
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

    logger.info(
      `Added ${playbackData.title} to scrobble queue to ${scrobblesOnUsers.length} users`
    );

    const fourMinutesInMillis = 240000;

    const timeUntilScrobbling = Math.min(
      Math.floor(track.durationInMillis / 2),
      fourMinutesInMillis
    );

    const cancelScrobble = new ButtonBuilder()
      .setCustomId('cancel')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      cancelScrobble
    );

    const scrobbleEmbed = new EmbedBuilder()
      .setTitle('Adicionado a fila de scrobbling :headphones:')
      .setDescription(
        `A música **${
          track.name
        }** foi adicionada a fila de scrobbling para os seguintes usuários:\n
      ${scrobblesOnUsers.map((id) => `<@${id}>`).join('\n')}
      `
      )
      .setThumbnail(track.coverArtUrl)
      .setFooter({
        text: `Scrobbling em ${millisecondsToFormattedText(
          timeUntilScrobbling
        )}`,
      })
      .setColor('#1DB954');

    const scrobbleEmbedRef = await message.channel.send({
      embeds: [scrobbleEmbed],
      components: [row],
    });

    let collector = scrobbleEmbedRef.createMessageComponentCollector();

    collector.on('collect', async (i) => {
      scrobblesOnUsers = scrobblesOnUsers.filter((id) => id !== i.user.id);
      await marquinhosApi.removeUserFromScrobbleQueue(scrobbleId, i.user.id);
      scrobbleEmbed.setDescription(
        `A música **${
          track.name
        }** foi adicionada a fila de scrobbling para os seguintes usuários:\n
      ${scrobblesOnUsers.map((id) => `<@${id}>`).join('\n')}
      `
      );
      await i.deferUpdate();
      await scrobbleEmbedRef.edit({
        embeds: [scrobbleEmbed],
        components: [row],
      });

      collector = scrobbleEmbedRef.createMessageComponentCollector();
    });

    setTimeout(() => {
      cancelScrobble.setDisabled(true);
      row.setComponents([cancelScrobble]);
      marquinhosApi.dispatchScrobbleQueue(scrobbleId).then(() => {
        scrobbleEmbed.setTitle('Scrobble feito com sucesso');
        scrobbleEmbed.setDescription(
          `O scrobble da música **${
            track.name
          }** foi feito com sucesso para os seguintes usuários:\n
      ${scrobblesOnUsers.map((id) => `<@${id}>`).join('\n')}
      `
        );
        scrobbleEmbedRef.edit({
          embeds: [scrobbleEmbed],
          components: [row],
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
