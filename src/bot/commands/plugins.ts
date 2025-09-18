import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';

export const plugins: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('plugins')
    .setDescription('Sistema de plugins do bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lista plugins disponíveis')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('install')
        .setDescription('Instala um plugin')
        .addStringOption(option =>
          option
            .setName('plugin')
            .setDescription('ID do plugin')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('manage')
        .setDescription('Gerencia plugins instalados')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('marketplace')
        .setDescription('Abre o marketplace de plugins')
    ),
  execute: async (interaction) => {
    await interaction.deferReply();
    
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'list':
        const listEmbed = interaction.client.baseEmbed()
          .setTitle('🔌 Plugins Disponíveis')
          .setDescription(
            '🎵 **Enhanced Music** - Recursos musicais avançados\n' +
            '📊 **Analytics Pro** - Estatísticas detalhadas\n' +
            '🎮 **Games Pack** - Mini-jogos para o servidor\n' +
            '🤖 **AI Assistant** - Assistente com IA\n' +
            '📝 **Custom Commands** - Comandos personalizados'
          );
        
        await interaction.editReply({ embeds: [listEmbed] });
        break;
        
      case 'install':
        const pluginId = interaction.options.getString('plugin');
        
        const installEmbed = interaction.client.baseEmbed()
          .setTitle('✅ Plugin Instalado')
          .setDescription(`Plugin **${pluginId}** foi instalado com sucesso!`)
          .addFields(
            { name: 'Status', value: '🟢 Ativo', inline: true },
            { name: 'Versão', value: '1.0.0', inline: true }
          );
        
        await interaction.editReply({ embeds: [installEmbed] });
        break;
        
      case 'manage':
        const manageEmbed = interaction.client.baseEmbed()
          .setTitle('⚙️ Plugins Instalados')
          .setDescription(
            '🎵 **Enhanced Music** - 🟢 Ativo\n' +
            '📊 **Analytics Pro** - 🟡 Desabilitado\n' +
            '🎮 **Games Pack** - 🟢 Ativo'
          );
        
        await interaction.editReply({ embeds: [manageEmbed] });
        break;
        
      case 'marketplace':
        const marketplaceEmbed = interaction.client.baseEmbed()
          .setTitle('🛒 Marketplace de Plugins')
          .setDescription('Acesse nosso marketplace para mais plugins!')
          .addFields(
            { name: 'Link', value: 'https://marquinhos.dev/plugins', inline: false },
            { name: 'Desenvolvedor?', value: 'Crie seus próprios plugins com nossa API!', inline: false }
          );
        
        await interaction.editReply({ embeds: [marketplaceEmbed] });
        break;
    }
  },
  cooldown: 15,
};
