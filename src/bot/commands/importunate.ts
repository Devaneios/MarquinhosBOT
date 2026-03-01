import { SlashCommand } from '@marquinhos/types';
import { GuildMember, SlashCommandBuilder } from 'discord.js';

export const importunate: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('importunar')
    .setDescription(
      'Eu vou lá no canal de voz atazanar a vida de quem tu quiser.',
    )
    .addUserOption((option) =>
      option
        .setName('importunado')
        .setDescription('Quem você quer que eu irrite?')
        .setRequired(true),
    ),
  execute: async (interaction) => {
    const member = interaction.options.get('importunado')
      ?.member as GuildMember;

    if (member.user.bot) {
      interaction.reply({ content: 'Nunca vou conseguir irritar um bot' });
      return;
    }

    if (member.voice.channel) {
      interaction.reply({ content: `${member} AEHOOOOOOOOOOOOOO` });
    } else {
      interaction.reply({
        content: 'Acho que essa pessoa aí não tá num canal de voz..',
      });
    }
  },
  cooldown: 10,
};
