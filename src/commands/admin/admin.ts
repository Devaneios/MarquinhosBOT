import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  buildNewWordImage,
  buildNoticeImage,
  buildStatsImage,
  type TermoStats,
} from '@marquinhos/ui/screens/termo';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import {
  AttachmentBuilder,
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
          const channelName = `#${channel.name}`;
          const buffer = await buildNoticeImage(
            'TERMO CONFIGURADO',
            `Canal configurado para ${channelName}.`,
            { badge: 'ADMIN' },
          );
          const attachment = new AttachmentBuilder(buffer, {
            name: 'termo-configurado.png',
          });
          await interaction.editReply({
            files: [attachment],
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

          const adminBuffer = await buildNewWordImage(
            {
              word: result.word,
              wordLength: result.wordLength,
              wordDate: result.wordDate,
              stats: result.stats,
            },
            { revealWord: true, admin: true },
          );
          const adminAttachment = new AttachmentBuilder(adminBuffer, {
            name: 'nova-palavra-admin.png',
          });

          await interaction.editReply({ files: [adminAttachment] });

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
            const publicBuffer = await buildNewWordImage({
              wordLength: result.wordLength,
              wordDate: result.wordDate,
              message: 'tomara que errem.',
            });
            const publicAttachment = new AttachmentBuilder(publicBuffer, {
              name: 'nova-palavra.png',
            });
            await wordleChannel.send({ files: [publicAttachment] });
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

          const buffer = await buildStatsImage(stats as TermoStats, {
            title: 'STATUS DO TERMO',
            revealWord: true,
          });
          const attachment = new AttachmentBuilder(buffer, {
            name: 'termo-status.png',
          });

          await interaction.editReply({ files: [attachment] });
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
