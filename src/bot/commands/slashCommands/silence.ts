import { Guild, GuildMember, SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from '@marquinhos/types';
import GuildUserModel from '@marquinhos/database/schemas/guildUser';

export const silence: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('silenciar')
    .setDescription('SILÊNCIO')
    .addUserOption((option) =>
      option
        .setName('silenciado')
        .setDescription('A pessoa que você quer que eu silencie.')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const silenced = interaction.options.get('silenciado')
      ?.member as GuildMember;
    if (silenced.user.id === interaction.client.user?.id) {
      await silenceMember(interaction.member as GuildMember);
      await interaction.reply({ content: 'Po, vei, seja inteligente' });
      return;
    }

    if (silenced.user.bot) {
      await interaction.reply({
        content: 'Não pode fazer isso com meus amigos bots.',
      });
      return;
    }

    const userSilenced = silenceMember(silenced);

    if (!userSilenced) {
      await interaction.reply({ content: `${silenced} já está caladinho!` });
      return;
    }
    await interaction.reply({ content: `${silenced} SILÊNCIO!` });
  },
  cooldown: 10,
  disabled: true,
};

async function silenceMember(member: GuildMember) {
  const guildUser = await GuildUserModel.findOne({
    guildId: member.guild.id,
    userId: member.id,
  });

  if (!guildUser) {
    const newGuildUser = new GuildUserModel({
      guildId: member.guild.id,
      userId: member.id,
      silenced: true,
    });
    await newGuildUser.save();
    return true;
  }

  if (guildUser.silenced) {
    return null;
  }

  guildUser.silenced = true;
  await guildUser.save();

  return true;
}
