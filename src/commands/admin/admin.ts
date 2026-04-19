import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import { MessageFlags, PermissionFlagsBits, TextChannel } from 'discord.js';

const api = MarquinhosApiService.getInstance();

export class AdminCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'admin', cooldownDelay: 5_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Comandos administrativos')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup((group) =>
          group
            .setName('termo')
            .setDescription('Gerenciar o jogo Termo')
            .addSubcommand((sub) =>
              sub
                .setName('novo')
                .setDescription(
                  'Força uma nova palavra para o Termo (uso em testes)',
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('canal')
                .setDescription(
                  'Define o canal onde o Termo envia mensagens públicas',
                )
                .addChannelOption((opt) =>
                  opt
                    .setName('canal')
                    .setDescription('Canal de texto para o Termo')
                    .setRequired(true),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('status')
                .setDescription(
                  'Exibe as estatísticas de hoje (revela a palavra)',
                ),
            ),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const subgroup = interaction.options.getSubcommandGroup(true);
    const sub = interaction.options.getSubcommand(true);

    if (subgroup === 'termo') {
      if (sub === 'canal') {
        const channel = interaction.options.getChannel('canal', true);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
          await api.setWordleConfig(interaction.guildId!, channel.id);
          await interaction.editReply({
            content: `✅ Canal do Termo configurado para <#${channel.id}>`,
          });
        } catch (err) {
          logger.warn('admin termo canal: Error saving config:', err);
          await interaction.editReply({
            content: '❌ Erro ao salvar configuração.',
          });
        }
        return;
      }

      if (sub === 'novo') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
          const response = await api.forceNewWordleWord(interaction.guildId!);
          const result = response.data as {
            word: string;
            wordLength: number;
            wordDate: string;
            stats?: {
              playersCount?: number;
              winnersCount?: number;
              avgAttempts?: number;
            };
          };

          const embed = baseEmbed(this.container.client);
          embed
            .setTitle('Nova palavra do Termo gerada!')
            .setDescription(
              `**Palavra:** \`${result.word.toUpperCase()}\` (${result.wordLength} letras)\n` +
                `**Data:** ${result.wordDate}`,
            )
            .addFields({
              name: 'Estatísticas anteriores',
              value:
                `👥 Jogadores: ${result.stats?.playersCount ?? 0}\n` +
                `✅ Acertos: ${result.stats?.winnersCount ?? 0}\n` +
                `📊 Média de tentativas: ${result.stats?.avgAttempts ?? 0}`,
            });

          await interaction.editReply({ embeds: [embed] });

          try {
            const configResponse = await api.getWordleConfig(
              interaction.guildId!,
            );
            const channelId = (configResponse.data as { channelId?: string })
              ?.channelId;
            if (!channelId) return;
            const wordleChannel = interaction.client.channels.cache.get(
              channelId,
            ) as TextChannel | undefined;
            if (!wordleChannel) return;
            await wordleChannel.send(
              `**Nova palavra!** (${result.wordLength} letras) — tomara que errem!\n${'⬜'.repeat(result.wordLength)}`,
            );
          } catch (err) {
            logger.warn(
              'admin termo novo: Error posting to wordle channel:',
              err,
            );
          }
        } catch (err) {
          logger.warn('admin termo novo: Error generating word:', err);
          await interaction.editReply({
            content: '❌ Erro ao gerar nova palavra.',
          });
        }
        return;
      }

      if (sub === 'status') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
          const response = await api.getWordleStats(interaction.guildId!);
          const stats = response.data as {
            wordDate: string;
            wordLength: number;
            playersCount: number;
            winnersCount: number;
            avgAttempts: number;
          };

          const embed = baseEmbed(this.container.client);
          embed.setTitle('📊 Termo — Estatísticas de Hoje').addFields(
            { name: 'Data', value: stats.wordDate, inline: true },
            {
              name: 'Tamanho',
              value: `${stats.wordLength} letras`,
              inline: true,
            },
            {
              name: 'Jogadores',
              value: String(stats.playersCount),
              inline: true,
            },
            {
              name: 'Acertos',
              value: String(stats.winnersCount),
              inline: true,
            },
            {
              name: 'Média de tentativas',
              value: String(stats.avgAttempts),
              inline: true,
            },
          );

          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          logger.warn('admin termo status: Error fetching stats:', err);
          await interaction.editReply({
            content: '❌ Erro ao buscar estatísticas.',
          });
        }
        return;
      }
    }
  }
}
