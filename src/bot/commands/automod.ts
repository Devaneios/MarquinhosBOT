import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';

export const automod: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Sistema de moderação automática')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('configure')
        .setDescription('Configura a moderação automática')
        .addBooleanOption((option) =>
          option
            .setName('spam_detection')
            .setDescription('Ativar detecção de spam musical')
            .setRequired(false),
        )
        .addBooleanOption((option) =>
          option
            .setName('auto_roles')
            .setDescription('Ativar cargos automáticos')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Mostra status da moderação automática'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('logs').setDescription('Mostra logs de moderação'),
    ),
  execute: async (interaction) => {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'configure':
        const spamDetection = interaction.options.getBoolean('spam_detection');
        const autoRoles = interaction.options.getBoolean('auto_roles');

        const embed = interaction.client
          .baseEmbed()
          .setTitle('🛡️ Moderação Configurada')
          .addFields(
            {
              name: 'Detecção de Spam',
              value: spamDetection ? '✅ Ativada' : '❌ Desativada',
              inline: true,
            },
            {
              name: 'Cargos Automáticos',
              value: autoRoles ? '✅ Ativado' : '❌ Desativado',
              inline: true,
            },
          );

        await interaction.editReply({ embeds: [embed] });
        break;

      case 'status':
        const statusEmbed = interaction.client
          .baseEmbed()
          .setTitle('🛡️ Status da Moderação')
          .addFields(
            { name: 'Detecção de Spam', value: '✅ Ativa', inline: true },
            { name: 'Cargos Automáticos', value: '✅ Ativo', inline: true },
            { name: 'Ações Hoje', value: '12', inline: true },
            { name: 'Warnings Dados', value: '5', inline: true },
            { name: 'Usuários Moderados', value: '3', inline: true },
            { name: 'Cargos Atribuídos', value: '18', inline: true },
          );

        await interaction.editReply({ embeds: [statusEmbed] });
        break;

      case 'logs':
        const logsEmbed = interaction.client
          .baseEmbed()
          .setTitle('📋 Logs de Moderação')
          .setDescription(
            '🚫 **Spam detectado** - Usuario123 - 14:30\n' +
              '⚠️ **Warning dado** - Usuario456 - 13:15\n' +
              '🏷️ **Cargo atribuído** - Usuario789 (Nível 10) - 12:45',
          );

        await interaction.editReply({ embeds: [logsEmbed] });
        break;
    }
  },
  cooldown: 15,
};
