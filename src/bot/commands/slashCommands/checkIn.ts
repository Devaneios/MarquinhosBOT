import { SlashCommandBuilder, EmbedBuilder, GuildMember } from 'discord.js';

import { SlashCommand } from 'src/types';

const DATE_LOCALE_CONFIG: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Recife',
};

const WEEKDAY_LOCALE_CONFIG: Intl.DateTimeFormatOptions = {
  weekday: 'long',
};

export const checkIn: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('check-in')
    .setDescription('Mostra quando você entrou no servidor'),
  execute: async (interaction) => {
    const member = interaction.member as GuildMember;
    const guildName = interaction.guild?.name as string;
    interaction.reply({
      embeds: [
        new EmbedBuilder().setDescription(checkInReply(member, guildName)),
      ],
    });
  },
  cooldown: 10,
};

export const checkInReply = (member: GuildMember, guildName: string) => {
  const memberJoinedDate = new Date(member.joinedTimestamp);
  const formatedMemberJoinedTimestamp = memberJoinedDate.toLocaleString(
    'pt-BR',
    DATE_LOCALE_CONFIG
  );
  const dayOfTheWeekMemberJoined = memberJoinedDate.toLocaleString(
    'pt-BR',
    WEEKDAY_LOCALE_CONFIG
  );

  return `Você entrou no ${guildName} ${
    ['sábado', 'domingo'].includes(dayOfTheWeekMemberJoined) ? 'no' : 'na'
  } ${formatedMemberJoinedTimestamp}`;
};
