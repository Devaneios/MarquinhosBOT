import { baseEmbed, type BaseEmbedClient } from '@marquinhos/utils/discord';
import { Track } from 'discord-player';
import { EmbedBuilder } from 'discord.js';

export function buildNowPlayingEmbed(
  client: BaseEmbedClient,
  track: Track,
  addedBy: string,
): EmbedBuilder {
  return baseEmbed(client)
    .setTitle('Tocando agora')
    .setDescription(`[${track.title}](${track.url})`)
    .addFields(
      { name: 'Autor', value: track.author, inline: true },
      { name: 'Duração', value: track.duration, inline: true },
      { name: 'Adicionado por', value: `<@${addedBy}>` },
    )
    .setThumbnail(track.thumbnail);
}

export function buildTrackAddedEmbed(
  client: BaseEmbedClient,
  track: Track,
  addedBy: string,
): EmbedBuilder {
  return baseEmbed(client)
    .setTitle('Adicionada a fila')
    .setDescription(`[${track.title}](${track.url})`)
    .addFields(
      { name: 'Autor', value: track.author, inline: true },
      { name: 'Duração', value: track.duration, inline: true },
      { name: 'Adicionado por', value: `<@${addedBy}>` },
    )
    .setThumbnail(track.thumbnail);
}
