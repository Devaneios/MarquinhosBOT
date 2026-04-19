import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';

export class PluginsCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'plugins', cooldownDelay: 15_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Sistema de plugins do bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((sub) =>
          sub.setName('list').setDescription('Lista plugins disponíveis'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('install')
            .setDescription('Instala um plugin')
            .addStringOption((opt) =>
              opt
                .setName('plugin')
                .setDescription('ID do plugin')
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub.setName('manage').setDescription('Gerencia plugins instalados'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('marketplace')
            .setDescription('Abre o marketplace de plugins'),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list': {
        const listEmbed = baseEmbed(this.container.client)
          .setTitle('🔌 Plugins Disponíveis')
          .setDescription(
            '🎵 **Enhanced Music** - Recursos musicais avançados\n' +
              '📊 **Analytics Pro** - Estatísticas detalhadas\n' +
              '🎮 **Games Pack** - Mini-jogos para o servidor\n' +
              '🤖 **AI Assistant** - Assistente com IA\n' +
              '📝 **Custom Commands** - Comandos personalizados',
          );
        await interaction.editReply({ embeds: [listEmbed] });
        break;
      }
      case 'install': {
        const pluginId = interaction.options.getString('plugin');
        const installEmbed = baseEmbed(this.container.client)
          .setTitle('✅ Plugin Instalado')
          .setDescription(`Plugin **${pluginId}** foi instalado com sucesso!`)
          .addFields(
            { name: 'Status', value: '🟢 Ativo', inline: true },
            { name: 'Versão', value: '1.0.0', inline: true },
          );
        await interaction.editReply({ embeds: [installEmbed] });
        break;
      }
      case 'manage': {
        const manageEmbed = baseEmbed(this.container.client)
          .setTitle('⚙️ Plugins Instalados')
          .setDescription(
            '🎵 **Enhanced Music** - 🟢 Ativo\n' +
              '📊 **Analytics Pro** - 🟡 Desabilitado\n' +
              '🎮 **Games Pack** - 🟢 Ativo',
          );
        await interaction.editReply({ embeds: [manageEmbed] });
        break;
      }
      case 'marketplace': {
        const marketplaceEmbed = baseEmbed(this.container.client)
          .setTitle('🛒 Marketplace de Plugins')
          .setDescription('Acesse nosso marketplace para mais plugins!')
          .addFields(
            {
              name: 'Link',
              value: 'https://marquinhos.dev/plugins',
              inline: false,
            },
            {
              name: 'Desenvolvedor?',
              value: 'Crie seus próprios plugins com nossa API!',
              inline: false,
            },
          );
        await interaction.editReply({ embeds: [marketplaceEmbed] });
        break;
      }
    }
  }
}
