import { SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from '@marquinhos/types';
import GuildModel from '@schemas/guild';

export const configRoles: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('config-roles')
    .setDescription('Configura os cargos do bot')
    .setDefaultMemberPermissions(0)
    .addStringOption((option) =>
      option
        .setName('tipo_do_cargo')
        .setDescription('The option to configure')
        .setRequired(true)
        .addChoices(
          { name: 'cargo_vip', value: 'vip' },
          { name: 'cargo_base', value: 'base' },
          { name: 'cargo_externo', value: 'externo' },
          { name: 'cargo_roleta', value: 'roleta' }
        )
    )
    .addRoleOption((option) =>
      option
        .setName('cargo')
        .setDescription('O cargo a ser configurado')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const roleType = interaction.options.get('tipo_do_cargo');
    const role = interaction.options.get('cargo');
    const guildId = interaction.guild?.id;
    const configRolesEmbed = interaction.client.baseEmbed();

    if (!roleType || !role || !guildId) {
      return interaction.reply({
        embeds: [configRolesEmbed.setDescription(`Falha ao configurar cargo`)],
      });
    }
    const roleId = role.value as string;

    if (roleType.value === 'externo') {
      await updateRole(guildId, 'externalRoleId', roleId as string);
    } else if (roleType.value === 'base') {
      await updateRole(guildId, 'baseRoleId', roleId as string);
    } else if (roleType.value === 'vip') {
      await updateRole(guildId, 'vipRoleId', roleId as string);
    } else if (roleType.value === 'roleta') {
      await updateRole(guildId, 'rouletteRoleId', roleId as string);
    }

    const roleName = interaction.guild?.roles.cache.find(
      (r) => r.id === role?.value
    )?.name;

    interaction.reply({
      embeds: [
        configRolesEmbed.setDescription(
          `Cargo ${roleType.value} configurado como ${roleName}`
        ),
      ],
    });
  },
  cooldown: 10,
  disabled: true,
};

const updateRole = async (
  guildId: string,
  rolePath: string,
  roleId: string
): Promise<void> => {
  await GuildModel.findOneAndUpdate(
    {
      guildID: guildId,
    },
    { $set: { [`options.${rolePath}`]: roleId } },
    { new: true }
  ).exec();
};
