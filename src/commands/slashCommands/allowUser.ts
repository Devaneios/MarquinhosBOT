import {
  SlashCommandBuilder,
  EmbedBuilder,
  GuildMemberRoleManager,
} from 'discord.js';
import { SlashCommand } from '../../types';
import GuildModel from '../../database/schemas/guild';

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
    const userId = interaction.options.get('usuário').value as string;
    let externalRoleId = '';
    let baseRoleId = '';
    let vipRoleId = '';

    try {
      const guildRoles = await findRoles(interaction.guild?.id as string);

      externalRoleId = guildRoles.externalRoleId;
      baseRoleId = guildRoles.baseRoleId;
      vipRoleId = guildRoles.vipRoleId;

      if (!externalRoleId || !baseRoleId || !vipRoleId) {
        throw new Error('Roles not configured');
      }
    } catch (error: unknown) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription(
              'Cargos não configurados. Peça a um admin para usar o comando `/config-roles` para configurar os cargos.'
            )
            .setColor('#ff0000'),
        ],
      });
      throw new Error((error as Error).message);
    }

    if (
      !(interaction.member?.roles as GuildMemberRoleManager).cache.has(
        vipRoleId
      )
    ) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription('Você não tem permissão para usar esse comando.')
            .setColor('#ff0000'),
        ],
      });
      throw new Error('User not allowed');
    }

    const member = await interaction.guild?.members.fetch(userId);

    if (!member) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription('Usuário não encontrado.')
            .setColor('#ff0000'),
        ],
      });
      throw new Error('User not found');
    }

    const memberRoles = member.roles.cache;

    try {
      if (memberRoles.has(externalRoleId)) {
        await member.roles.remove(externalRoleId);
      } else if (memberRoles.has(baseRoleId)) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription('O usuário já tem acesso ao servidor.')
              .setColor('#ff0000'),
          ],
        });
        throw new Error('User already allowed');
      }

      if (!memberRoles.has(baseRoleId)) {
        await member.roles.add(baseRoleId);
      }
    } catch (error) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription('Erro ao liberar o usuário.')
            .setColor('#ff0000'),
        ],
      });
      throw new Error((error as Error).message);
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(
            `O usuário <@${userId}> foi liberado para acessar o servidor.`
          )
          .setColor('#00ff00'),
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
