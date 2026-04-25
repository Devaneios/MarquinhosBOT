import { GuildConfig } from '@marquinhos/config/guild';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  buildWordHiddenPreviewImage,
  buildWordPreviewImage,
} from '@marquinhos/ui/screens/termo';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import {
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';

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
          const channelName = channel.name ? `#${channel.name}` : channel.id;
          const embed = new EmbedBuilder()
            .setTitle('Termo configurado')
            .setDescription(`Canal configurado para ${channelName}.`)
            .setColor(0x588157);
          await interaction.editReply({ embeds: [embed] });
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

          const previewBuffer = await buildWordHiddenPreviewImage(
            result.wordLength,
          );
          const previewAttachment = new AttachmentBuilder(previewBuffer, {
            name: 'nova-palavra-admin.png',
          });

          const adminEmbed = new EmbedBuilder()
            .setTitle('Nova palavra definida')
            .addFields(
              { name: 'Palavra', value: result.word, inline: true },
              {
                name: 'Data',
                value: result.wordDate.split('-').reverse().join('/'),
                inline: true,
              },
              {
                name: 'Jogadores (rodada anterior)',
                value: String(result.stats?.playersCount ?? 0),
                inline: true,
              },
              {
                name: 'Acertos',
                value: String(result.stats?.winnersCount ?? 0),
                inline: true,
              },
              {
                name: 'Média',
                value: (result.stats?.avgAttempts ?? 0).toFixed(1),
                inline: true,
              },
            )
            .setColor(0x588157)
            .setImage('attachment://nova-palavra-admin.png');

          await interaction.editReply({
            embeds: [adminEmbed],
            files: [previewAttachment],
          });

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
            const embed = baseEmbed(this.container.client)
              .setTitle(`Novo Terminho - ${result.wordLength} letras`)
              .setDescription('tomara que errem.')
              .setColor(0x588157)
              .setImage('attachment://nova-palavra-admin.png');

            await wordleChannel.send({
              content: `<@&${GuildConfig.TERMINHOS_ANNOUNCE_ROLE_ID}>`,
              embeds: [embed],
              files: [previewAttachment],
            });
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
            word?: string;
          };

          const embed = new EmbedBuilder()
            .setTitle('Status do Termo')
            .addFields(
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
                name: 'Média',
                value: stats.avgAttempts.toFixed(1),
                inline: true,
              },
              { name: 'Letras', value: String(stats.wordLength), inline: true },
            )
            .setFooter({ text: stats.wordDate.split('-').reverse().join('/') })
            .setColor(0x588157);

          if (stats.word !== undefined) {
            const previewBuffer = await buildWordPreviewImage(stats.word);
            const previewAttachment = new AttachmentBuilder(previewBuffer, {
              name: 'termo-status.png',
            });
            await interaction.editReply({
              embeds: [embed],
              files: [previewAttachment],
            });
          } else {
            await interaction.editReply({ embeds: [embed] });
          }
        } catch (err) {
          logger.warn('admin termo status: Error fetching stats:', err);
          await interaction.editReply({
            content: '❌ Erro ao buscar status.',
          });
        }
        return;
      }
    }
  }
}
