import {
  SlashCommandBuilder,
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
  CommandInteraction,
} from 'discord.js';

import { Nullable, RolesConfig, SlashCommand } from '@marquinhos/types';
import GuildModel from '@schemas/guild';

const roleTranslations = {
  externalRoleId: 'Cargo externo',
  baseRoleId: 'Cargo base',
  vipRoleId: 'Cargo vip',
};

export const allowUser: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('permitir')
    .setDescription('Libero um usuário para ter acesso ao servidor.')
    .addUserOption((option) =>
      option
        .setName('usuário')
        .setDescription('Usuário que você quer liberar')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const userId = interaction.options.get('usuário')
      ?.value as Nullable<string>;
    const roles = (await findRoles(
      (interaction.member as GuildMember).guild.id
    )) as RolesConfig;
    const allowUserEmbed = interaction.client.baseEmbed();
    const selectedMember = (await interaction.guild?.members.fetch(
      userId ?? ''
    )) as GuildMember;

    await validateRoles(roles, interaction, allowUserEmbed);
    await validatePermissions(
      roles.vipRoleId as string,
      interaction,
      allowUserEmbed
    );
    await validateMemberExists(selectedMember, interaction, allowUserEmbed);
    await validateMemberHasAccess(
      selectedMember,
      roles,
      interaction,
      allowUserEmbed
    );

    try {
      await interaction.deferReply();
      await interaction.followUp({
        embeds: [
          allowUserEmbed
            .setThumbnail(selectedMember.user.displayAvatarURL())
            .setDescription(`Liberando o usuário <@${userId}>...`),
        ],
      });
      await selectedMember.roles.remove(roles.externalRoleId as string);
      await selectedMember.roles.add(roles.baseRoleId as string);
      await interaction.editReply({
        embeds: [
          allowUserEmbed
            .setTitle('Usuário liberado')
            .setDescription(
              `O usuário <@${userId}> foi liberado para acessar o servidor.`
            ),
        ],
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [
          allowUserEmbed
            .setTitle('Erro ao executar o comando')
            .setDescription(
              'Houve um erro ao liberar o usuário.\n\nTente novamente ou entre em contato com um admin.'
            )
            .setColor('#ff0000'),
        ],
      });
      throw new Error((error as Error).message);
    }
  },
  cooldown: 10,
  disabled: true,
};

async function findRoles(guildId: string): Promise<RolesConfig> {
  const guild = await GuildModel.findOne({ guildID: guildId }).exec();
  if (guild) {
    const { externalRoleId, baseRoleId, vipRoleId } = guild.options;
    return { externalRoleId, baseRoleId, vipRoleId };
  }
  return { externalRoleId: null, baseRoleId: null, vipRoleId: null };
}

function userHasPermission(member: GuildMember, vipRoleId: string): boolean {
  return (
    member.roles.cache.has(vipRoleId) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

async function validateRoles(
  roles: RolesConfig,
  interaction: CommandInteraction,
  allowUserEmbed: EmbedBuilder
) {
  let rolesNotConfiguredList = 'Os seguintes cargos não estão configurados: \n';

  for (const role in roles) {
    if (!roles[role as keyof RolesConfig]) {
      rolesNotConfiguredList += `- ${
        roleTranslations[role as keyof RolesConfig]
      }\n`;
    }
  }

  if (!roles.externalRoleId || !roles.baseRoleId || !roles.vipRoleId) {
    await interaction.reply({
      embeds: [
        allowUserEmbed
          .setTitle('Erro executar o comando')
          .setDescription(
            `${rolesNotConfiguredList}
Peça a um admin para usar o comando \` /configurar-cargos\` para configurar os cargos.`
          )
          .setColor('#ff0000'),
      ],
      ephemeral: true,
    });
    throw new Error('Roles not configured');
  }
}

async function validatePermissions(
  vipRoleId: string,
  interaction: CommandInteraction,
  allowUserEmbed: EmbedBuilder
) {
  if (!userHasPermission(interaction.member as GuildMember, vipRoleId)) {
    await interaction.reply({
      embeds: [
        allowUserEmbed
          .setTitle('Erro ao executar o comando')
          .setDescription('Você não tem permissão para usar esse comando.')
          .setColor('#ff0000'),
      ],
      ephemeral: true,
    });
    throw new Error('User not allowed');
  }
}

async function validateMemberExists(
  selectedMember: GuildMember,
  interaction: CommandInteraction,
  allowUserEmbed: EmbedBuilder
) {
  if (!selectedMember) {
    await interaction.reply({
      embeds: [
        allowUserEmbed
          .setTitle('Erro ao executar o comando')
          .setDescription('Usuário não encontrado.')
          .setColor('#ff0000'),
      ],
      ephemeral: true,
    });
    throw new Error('User not found');
  }
}

async function validateMemberHasAccess(
  selectedMember: GuildMember,
  roles: RolesConfig,
  interaction: CommandInteraction,
  allowUserEmbed: EmbedBuilder
) {
  if (
    !selectedMember.roles.cache.has(roles.externalRoleId as string) &&
    selectedMember.roles.cache.has(roles.baseRoleId as string)
  ) {
    await interaction.reply({
      embeds: [
        allowUserEmbed
          .setTitle('Erro ao executar o comando')
          .setDescription('Usuário já tem acesso ao servidor.')
          .setColor('#ff0000'),
      ],
      ephemeral: true,
    });
    throw new Error('User already allowed');
  }
}
