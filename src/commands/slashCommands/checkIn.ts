import { SlashCommandBuilder, EmbedBuilder, GuildMember } from 'discord.js';
import { SlashCommand } from '../../types';
import { checkInReply } from '../helpers/checkInHelper';

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
