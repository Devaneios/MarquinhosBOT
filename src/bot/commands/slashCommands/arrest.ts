import { GuildMember, SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from 'src/types';
import ArrestedModel from 'src/database/schemas/arrested';

export const arrest: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('prender')
    .setDescription('EU PRENDO ESSE CRIMINOSO')
    .addUserOption((option) =>
      option
        .setName('preso')
        .setDescription('A pessoa que você quer que eu prenda.')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const arrested = interaction.options.get('preso').member as GuildMember;
    if (arrested.user.id === process.env.BOT_ID) {
      arrestMember(interaction.member as GuildMember);
      interaction.reply({ content: 'Tu realmente tentou essa?' });
      return;
    }

    if (arrested.user.bot) {
      interaction.reply({ content: 'Não pode prender meus irmãos bots.' });
      return;
    }

    arrestMember(arrested);
    interaction.reply({ content: `${arrested} você está PRESO!` });
  },
  cooldown: 10,
};

function arrestMember(member: GuildMember) {
  const memberChannelId = member.voice.channelId;
  const newArrested = new ArrestedModel({
    id: member.id,
    user: member.user.username,
  });
  newArrested.save();
  if (memberChannelId && memberChannelId != member.guild.afkChannelId) {
    member.voice.setChannel(member.guild.afkChannelId);
  }
}
