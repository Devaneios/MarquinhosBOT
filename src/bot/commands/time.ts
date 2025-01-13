import {
  AttachmentBuilder,
  GuildMember,
  SlashCommandBuilder,
  VoiceChannel,
} from 'discord.js';
import { join } from 'path';

import { SlashCommand } from '@marquinhos/types';

export const time: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('horario')
    .setDescription('Eu te digo que horas são. Só isso.....'),
  execute: async (interaction) => {
    const member = interaction.member as GuildMember;
    const currentHour = getParsedTime(true);
    const unixTimestamp = Math.floor(Date.now() / 1000);
    const recifeTime = getParsedTime(false);
    const locationTimeEmbed = interaction.client
      .baseEmbed()
      .setDescription(
        `São ${recifeTime} em Recife e <t:${unixTimestamp}:t> onde quer que você esteja`
      );
    const voiceChannel = member.voice.channel as VoiceChannel;
    // If its midnight, Marquinhos enter the voice channel and ANNOUNCES that it's OLEO DE MACACO TIME
    if (currentHour == '00') {
      const attachment = new AttachmentBuilder(
        join(__dirname, '../../resources/images/oleodemacaco.png')
      );
      locationTimeEmbed
        .setTitle('O MACACO ESTÁ DE FÉRIAS')
        .setThumbnail('attachment://oleodemacaco.png');
      interaction.reply({
        files: [attachment],
        embeds: [locationTimeEmbed],
      });
    } else {
      // If its not midnight, Marquinhos send the time in the channel
      await interaction.reply({
        embeds: [locationTimeEmbed],
      });
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
