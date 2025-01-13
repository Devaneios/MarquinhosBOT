import { CommandInteraction, SlashCommandBuilder } from 'discord.js';

import { isCurrentlyInVoiceChannel } from '@marquinhos/bot/validators/voice-channel';
import { SlashCommand } from '@marquinhos/types';
import { Track, useQueue } from 'discord-player';

export const queue: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('fila')
    .setDescription('Mostra a fila de músicas'),
  validators: [isCurrentlyInVoiceChannel],
  execute: async (interaction: CommandInteraction) => {
    const queue = useQueue();

    if (!queue) {
      return await interaction.reply(
        'Este servidor não tem uma sessão de player ativa.'
      );
    }

    const currentTrack = queue.currentTrack;

    if (!currentTrack) {
      return await interaction.reply('Não há nenhuma faixa tocando.');
    }

    const upcomingTracks = queue.tracks.toArray().slice(0, 5);

    const message = [
      `**Tocando Agora:** ${currentTrack.title} - ${currentTrack.author}`,
      '',
      '**Próximas Faixas:**',
      ...upcomingTracks.map(
        (track: Track, index: number) =>
          `${index + 1}. ${track.title} - ${track.author}`
      ),
    ].join('\n');

    // Send the message
    return await interaction.reply(message);
  },
};
