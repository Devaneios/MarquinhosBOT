import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../../types';
import GuildModel from '../../database/schemas/guild';

export const getRoles: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('get-roles')
    .setDescription("get the bot's roles")
    .setDefaultMemberPermissions(0),
  execute: async (interaction) => {
    const { externalRoleId, baseRoleId, vipRoleId } = await findRoles(
      interaction.guild?.id as string
    );

    const externalRoleName = externalRoleId
      ? interaction.guild?.roles.cache.get(externalRoleId)?.name
      : 'Não definido';
    const baseRoleName = baseRoleId
      ? interaction.guild?.roles.cache.get(baseRoleId)?.name
      : 'Não definido';
    const vipRoleName = vipRoleId
      ? interaction.guild?.roles.cache.get(vipRoleId)?.name
      : 'Não definido';
    interaction.reply({
      embeds: [
        new EmbedBuilder().setDescription(
          `Cargo externo: ${externalRoleName}\n
            Cargo base: ${baseRoleName}\n
            Cargo VIP: ${vipRoleName}`
        ),
      ],
    });
  },
  cooldown: 10,
};

async function findRoles(guildId: string) {
  const guild = await GuildModel.findOne({ guildID: guildId }).exec();
  if (guild) {
    const { externalRoleId, baseRoleId, vipRoleId } = guild.options;
    return { externalRoleId, baseRoleId, vipRoleId };
  }
  return { externalRoleId: null, baseRoleId: null, vipRoleId: null };
}
