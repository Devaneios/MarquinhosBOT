import { GuildMember, SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from '@marquinhos/types';
import GuildUserModel from '@marquinhos/database/schemas/guildUser';

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
    const arrested = interaction.options.get('preso')?.member as GuildMember;
    if (arrested.user.id === interaction.client.user?.id) {
      await arrestMember(interaction.member as GuildMember);
      await interaction.reply({ content: 'Tu realmente tentou essa?' });
      return;
    }

    if (arrested.user.bot) {
      await interaction.reply({
        content: 'Não pode prender meus irmãos bots.',
      });
      return;
    }

    const arrestResult = await arrestMember(arrested);
    if (!arrestResult) {
      await interaction.reply({ content: `${arrested} já está preso!` });
      return;
    }
    interaction.reply({ content: `${arrested} você está PRESO!` });
  },
  cooldown: 10,
  disabled: true,
};

async function arrestMember(member: GuildMember) {
  const memberChannelId = member.voice.channelId;
  if (memberChannelId && memberChannelId != member.guild.afkChannelId) {
    member.voice.setChannel(member.guild.afkChannelId);
  }

  const guildUser = await GuildUserModel.findOne({
    guildId: member.guild.id,
    userId: member.id,
  });

  if (!guildUser) {
    const newGuildUser = new GuildUserModel({
      guildId: member.guild.id,
      userId: member.id,
      arrested: true,
    });
    return await newGuildUser.save();
  }

  if (guildUser.arrested) {
    return null;
  }

  guildUser.arrested = true;
  return await guildUser.save();
}
