import { GuildMember, SlashCommandBuilder, VoiceChannel } from 'discord.js';
import { join } from 'path';

import { SlashCommand } from 'src/types';
import { playAudio } from 'src/utils/discord';

export const time: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('horario')
    .setDescription('Eu te digo que horas são. Só isso.....'),
  execute: async (interaction) => {
    const member = interaction.member as GuildMember;
    const currentHour = getParsedTime(true);
    const voiceChannel = member.voice.channel as VoiceChannel;
    // If its midnight, Marquinhos enter the voice channel and ANNOUNCES that it's OLEO DE MACACO TIME
    if (currentHour == '00') {
      interaction.reply({
        files: [
          {
            attachment: join(
              __dirname,
              '../../../resources/images/oleodemacaco.png'
            ),
            name: 'oleodemacaco.png',
            description: 'HORÁRIO OFICIAL',
          },
        ],
      });
      if (voiceChannel) {
        playAudio(interaction, voiceChannel, '_macaco');
      }
    } else {
      // If its not midnight, Marquinhos send the time in the channel
      const currentTime = getParsedTime(false);
      interaction.reply(`Agora são ${currentTime}`);
    }
  },
  cooldown: 10,
};

const getParsedTime = (onlyHour: boolean) => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: onlyHour ? undefined : '2-digit',
    hour12: false,
    timeZone: 'America/Recife',
  };
  return now.toLocaleString('pt-BR', options);
};
