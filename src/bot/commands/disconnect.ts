import {
  SlashCommandBuilder,
  PermissionsBitField,
} from 'discord.js';
import { SlashCommand } from '@marquinhos/types';

export const disconnect: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('desconectar')
    .setDescription('Remove uma pessoa específica do canal de voz')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers)
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('O usuário que será desconectado')
        .setRequired(true),
    ) as SlashCommandBuilder,
  execute: async (interaction) => {
    const targetUser = interaction.options.get('usuario')?.user;
    const disconnectEmbed = interaction.client.baseEmbed();

    if (!targetUser) {
      await interaction.reply({
        embeds: [disconnectEmbed.setDescription('Usuário não encontrado.')],
      });
      return;
    }

    const member = await interaction.guild?.members.fetch(targetUser.id);
    if (!member) {
      await interaction.reply({
        embeds: [
          disconnectEmbed.setDescription(
            'Não foi possível encontrar o membro no servidor.',
          ),
        ],
      });
      return;
    }

    if (!member.voice.channel) {
      await interaction.reply({
        embeds: [
          disconnectEmbed.setDescription(
            'Este usuário não está em um canal de voz.',
          ),
        ],
      });
      return;
    }

    try {
      await member.voice.setChannel(null);
      await interaction.reply({
        embeds: [
          disconnectEmbed.setDescription(
            `${member.user.username} foi desconectado do canal de voz.`,
          ),
        ],
      });
    } catch (_error) {
      await interaction.reply({
        embeds: [
          disconnectEmbed.setDescription(
            'Não foi possível desconectar o usuário. Verifique se tenho as permissões necessárias.',
          ),
        ],
      });
    }
  },
  cooldown: 5,
};
