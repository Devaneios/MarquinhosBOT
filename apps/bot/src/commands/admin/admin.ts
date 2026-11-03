import { HttpError } from '@marquinhos/api-client/bot';
import { buildWordleConversation } from '@marquinhos/commands/games/termoConversation';
import { previousRecifeDate } from '@marquinhos/commands/games/termoDate';
import { sendTermoStatusBroadcast } from '@marquinhos/commands/games/termoLeaderboardImage';
import { collectVerifiedLeaderboard } from '@marquinhos/commands/games/termoLeaderboardMembers';
import { GuildConfig } from '@marquinhos/config/guild';
import { GameManager } from '@marquinhos/game/core/GameManager';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  buildTermoLeaderboardImage,
  buildWordHiddenPreviewImage,
  denseRanks,
  type DailyEntry,
  type RankedEntry,
} from '@marquinhos/ui/screens/termo';
import {
  asTextChannel,
  baseEmbed,
  fetchAvatarBuffer,
} from '@marquinhos/utils/discord';
import { getRecentErrors } from '@marquinhos/utils/errorHistory';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { z } from 'zod';
import {
  buildWordlistReviewActionRow,
  buildWordlistReviewContent,
} from './wordlistReviewResponse';

const LeaderboardPeriodSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'all-time',
]);

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
        .addSubcommand((sub) =>
          sub
            .setName('status')
            .setDescription(
              'Mostra o status atual do bot (API, sessões, erros, uptime)',
            ),
        )
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
                  'Envia o status de hoje no canal do Termo (sem revelar a palavra)',
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('leaderboard')
                .setDescription('Veja o ranking do Terminhos')
                .addStringOption((opt) =>
                  opt
                    .setName('periodo')
                    .setDescription('Período do ranking')
                    .setRequired(true)
                    .addChoices(
                      { name: 'Hoje', value: 'daily' },
                      { name: 'Esta semana', value: 'weekly' },
                      { name: 'Este mês', value: 'monthly' },
                      { name: 'Histórico', value: 'all-time' },
                    ),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('meta')
                .setDescription('Agenda uma meta coletiva para o Terminhos')
                .addIntegerOption((opt) =>
                  opt
                    .setName('alvo')
                    .setDescription('Participações distintas necessárias')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(100000),
                )
                .addStringOption((opt) =>
                  opt
                    .setName('inicio')
                    .setDescription('Primeiro dia, AAAA-MM-DD (Recife)')
                    .setRequired(true),
                )
                .addStringOption((opt) =>
                  opt
                    .setName('fim')
                    .setDescription('Último dia, AAAA-MM-DD (Recife)')
                    .setRequired(true),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('anuncios')
                .setDescription('Configura anúncios comunitários do Terminhos')
                .addBooleanOption((opt) =>
                  opt
                    .setName('coletivo')
                    .setDescription('Anunciar páginas e metas concluídas')
                    .setRequired(true),
                )
                .addBooleanOption((opt) =>
                  opt
                    .setName('resumo')
                    .setDescription('Ativar resumo semanal')
                    .setRequired(true),
                )
                .addChannelOption((opt) =>
                  opt
                    .setName('canal')
                    .setDescription(
                      'Canal de anúncios; omita para manter pendentes',
                    )
                    .addChannelTypes(ChannelType.GuildText),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('incertos')
                .setDescription('Lista anúncios que precisam de conferência'),
            )
            .addSubcommand((sub) =>
              sub
                .setName('conciliar')
                .setDescription(
                  'Registra o resultado da conferência de um anúncio',
                )
                .addStringOption((opt) =>
                  opt
                    .setName('id')
                    .setDescription('ID do anúncio listado em incertos')
                    .setRequired(true),
                )
                .addStringOption((opt) =>
                  opt
                    .setName('resultado')
                    .setDescription('Confirme após verificar o canal')
                    .setRequired(true)
                    .addChoices(
                      { name: 'Mensagem encontrada', value: 'found' },
                      {
                        name: 'Confirmado que não foi enviada',
                        value: 'confirmed_absent',
                      },
                    ),
                )
                .addStringOption((opt) =>
                  opt
                    .setName('mensagem')
                    .setDescription('ID da mensagem encontrada, quando houver'),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('bingo')
                .setDescription('Agenda uma cartela comunitária de bingo')
                .addStringOption((opt) =>
                  opt
                    .setName('inicio')
                    .setDescription('Primeiro dia, AAAA-MM-DD (Recife)')
                    .setRequired(true),
                )
                .addStringOption((opt) =>
                  opt
                    .setName('fim')
                    .setDescription('Último dia, AAAA-MM-DD (Recife)')
                    .setRequired(true),
                )
                .addBooleanOption((opt) =>
                  opt
                    .setName('multiplas')
                    .setDescription('Uma ação pode preencher várias casas?')
                    .setRequired(true),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('conversa')
                .setDescription(
                  'Inicia uma conversa sobre uma partida encerrada',
                )
                .addStringOption((opt) =>
                  opt
                    .setName('dia')
                    .setDescription('Data da partida encerrada, AAAA-MM-DD')
                    .setRequired(true),
                ),
            ),
        )
        .addSubcommandGroup((group) =>
          group
            .setName('wordlist')
            .setDescription('Gerenciar a wordlist do Termo')
            .addSubcommand((sub) =>
              sub
                .setName('review')
                .setDescription(
                  'Revisa a próxima palavra pendente da wordlist.txt',
                ),
            ),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const subgroup = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand(true);

    if (subgroup === null && sub === 'status') {
      await this.handleStatus(interaction);
      return;
    }

    if (subgroup === 'termo') {
      if (sub === 'conversa') {
        if (
          !interaction.guildId ||
          !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
        ) {
          await interaction.reply({
            content: '❌ Somente administradores podem iniciar a conversa.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const date = interaction.options.getString('dia', true);
          const content = buildWordleConversation(date, previousRecifeDate());
          if (!content) {
            await interaction.editReply({
              content: '❌ Escolha uma data válida que já terminou em Recife.',
            });
            return;
          }
          const config = await api.getWordleConfig(interaction.guildId);
          const channel = config.data.channelId
            ? asTextChannel(
                interaction.client.channels.cache.get(config.data.channelId),
              )
            : null;
          if (!channel || channel.guildId !== interaction.guildId) {
            await interaction.editReply({
              content: '❌ Configure um canal do Terminhos neste servidor.',
            });
            return;
          }
          const day = await api.getWordleDayGuesses(interaction.guildId, date);
          if (!day.data || day.data.wordDate !== date) {
            await interaction.editReply({
              content: '❌ Não há partida registrada para essa data.',
            });
            return;
          }
          await channel.send({ content, allowedMentions: { parse: [] } });
          await interaction.editReply({
            content: `✅ Conversa publicada em <#${channel.id}>.`,
          });
        } catch (error) {
          logger.warn('admin termo conversa failed', error);
          await interaction.editReply({
            content: '❌ Não foi possível iniciar a conversa.',
          });
        }
        return;
      }
      if (sub === 'bingo') {
        if (
          !interaction.guildId ||
          !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
        ) {
          await interaction.reply({
            content: '❌ Somente administradores podem agendar o bingo.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const firstDate = interaction.options.getString('inicio', true);
          const lastDate = interaction.options.getString('fim', true);
          const allowMulti = interaction.options.getBoolean('multiplas', true);
          await api.createWordleBingo(
            interaction.guildId,
            firstDate,
            lastDate,
            allowMulti,
          );
          await interaction.editReply({
            content: `✅ Bingo agendado de ${firstDate} a ${lastDate} (horário de Recife).`,
          });
        } catch (error) {
          logger.warn('admin termo bingo failed', error);
          await interaction.editReply({
            content:
              '❌ Não foi possível agendar o bingo. Confira as datas futuras.',
          });
        }
        return;
      }
      if (sub === 'incertos' || sub === 'conciliar') {
        if (
          !interaction.guildId ||
          !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
        ) {
          await interaction.reply({
            content: '❌ Somente administradores podem conciliar anúncios.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          if (sub === 'incertos') {
            const rows = (
              await api.listUncertainWordleNotifications(interaction.guildId)
            ).data;
            const lines = rows.map(
              (row) =>
                `• \`${row.id}\` · ${row.kind} · ${row.channelId ? `<#${row.channelId}>` : 'sem canal'}`,
            );
            await interaction.editReply({
              content: lines.length
                ? `Confira cada canal antes de conciliar:\n${lines.join('\n')}`.slice(
                    0,
                    1900,
                  )
                : 'Nenhum anúncio aguardando conferência.',
            });
          } else {
            const id = interaction.options.getString('id', true);
            const result = interaction.options.getString('resultado', true);
            const messageId = interaction.options.getString('mensagem');
            if (
              result === 'found' &&
              (!messageId || !/^\d{1,20}$/.test(messageId))
            ) {
              await interaction.editReply({
                content: '❌ Informe o ID da mensagem encontrada no Discord.',
              });
              return;
            }
            if (result !== 'found' && result !== 'confirmed_absent') {
              await interaction.editReply({
                content: '❌ Resultado inválido.',
              });
              return;
            }
            const body =
              result === 'found'
                ? ({ id, result, messageId: messageId! } as const)
                : ({ id, result } as const);
            const response = await api.resolveWordleNotification(
              interaction.guildId,
              body,
            );
            await interaction.editReply({
              content: response.data.recorded
                ? '✅ Conferência registrada.'
                : '❌ Anúncio não encontrado ou já conciliado.',
            });
          }
        } catch (error) {
          logger.warn('admin termo conciliacao failed', error);
          await interaction.editReply({
            content: '❌ Não foi possível consultar ou conciliar os anúncios.',
          });
        }
        return;
      }
      if (sub === 'anuncios') {
        if (
          !interaction.guildId ||
          !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
        ) {
          await interaction.reply({
            content: '❌ Somente administradores podem configurar anúncios.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const channel = interaction.options.getChannel('canal');
          await api.setWordleNotificationConfig(interaction.guildId, {
            channelId: channel?.id ?? null,
            collective: interaction.options.getBoolean('coletivo', true),
            weekly: interaction.options.getBoolean('resumo', true),
          });
          await interaction.editReply({
            content: channel
              ? `✅ Preferências salvas para <#${channel.id}>.`
              : '✅ Preferências salvas. Os anúncios ficarão pendentes até um canal ser configurado.',
          });
        } catch (error) {
          logger.warn('admin termo anuncios: configuration failed', error);
          await interaction.editReply({
            content: '❌ Não foi possível salvar as preferências.',
          });
        }
        return;
      }
      if (sub === 'meta') {
        if (
          !interaction.guildId ||
          !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
        ) {
          await interaction.reply({
            content:
              '❌ Somente administradores podem criar metas neste servidor.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const target = interaction.options.getInteger('alvo', true);
          const firstDate = interaction.options.getString('inicio', true);
          const lastDate = interaction.options.getString('fim', true);
          await api.createWordleGoal(
            interaction.guildId,
            target,
            firstDate,
            lastDate,
          );
          await interaction.editReply({
            content: `✅ Meta agendada: ${target} participações de ${firstDate} a ${lastDate} (horário de Recife).`,
          });
        } catch (error) {
          logger.warn('admin termo meta: failed to create goal', error);
          await interaction.editReply({
            content:
              '❌ Não foi possível agendar a meta. Confira o alvo e as datas futuras no formato AAAA-MM-DD.',
          });
        }
        return;
      }
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
        await interaction.deferReply();

        try {
          const response = await api.forceNewWordleWord(interaction.guildId!);
          const result = response.data;

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

          const adminMessage = await interaction.editReply({
            embeds: [adminEmbed],
            files: [previewAttachment],
          });

          const adminThread = await adminMessage.startThread({
            name: `Nova palavra - ${result.wordLength} letras`,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
          });
          await adminThread.edit({ flags: adminThread.flags.add(2097152) });

          try {
            const configResponse = await api.getWordleConfig(
              interaction.guildId!,
            );
            const channelId = configResponse.data.channelId;
            if (!channelId) return;
            const wordleChannel = asTextChannel(
              interaction.client.channels.cache.get(channelId),
            );
            if (!wordleChannel) return;
            const embed = baseEmbed(this.container.client)
              .setTitle(`Novo Terminho - ${result.wordLength} letras`)
              .setDescription('tomara que errem.')
              .setColor(0x588157)
              .setImage('attachment://nova-palavra-admin.png');

            const announcement = await wordleChannel.send({
              content: `<@&${GuildConfig.TERMINHOS_ANNOUNCE_ROLE_ID}>`,
              embeds: [embed],
              files: [previewAttachment],
            });
            const announcementThread = await announcement.startThread({
              name: `Novo Terminho - ${result.wordLength} letras`,
              autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
            });
            await announcementThread.edit({
              flags: announcementThread.flags.add(2097152),
            });
          } catch (err) {
            logger.warn(
              'admin termo novo: Error posting to wordle channel:',
              err,
            );
          }
        } catch (err) {
          if (err instanceof HttpError && err.response?.status === 409) {
            await interaction.editReply({
              content: '❌ A palavra global só muda na virada do dia.',
            });
            return;
          }
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
          const configResponse = await api.getWordleConfig(
            interaction.guildId!,
          );
          const channelId = configResponse.data.channelId;
          const channel = channelId
            ? asTextChannel(interaction.client.channels.cache.get(channelId))
            : undefined;

          if (!channel) {
            await interaction.editReply({
              content:
                '❌ Nenhum canal do Termo configurado para este servidor.',
            });
            return;
          }

          const sent = await sendTermoStatusBroadcast(
            interaction.client,
            interaction.guildId!,
            channel,
          );

          await interaction.editReply({
            content: sent
              ? `✅ Status enviado em ${channel}.`
              : 'ℹ️ Ainda não há tentativas hoje para mostrar.',
          });
        } catch (err) {
          logger.warn('admin termo status: Error sending status:', err);
          await interaction.editReply({
            content: '❌ Erro ao enviar status.',
          });
        }
        return;
      }

      if (sub === 'leaderboard') {
        const rawPeriod = interaction.options.getString('periodo', true);
        const period = LeaderboardPeriodSchema.parse(rawPeriod);

        await interaction.deferReply();

        try {
          const guild = interaction.guild!;
          let entries: (DailyEntry | RankedEntry)[];
          let groupStreak: number;

          if (period === 'daily') {
            const response = await collectVerifiedLeaderboard(
              (offset) =>
                api.getWordleLeaderboard(
                  interaction.guildId!,
                  period,
                  undefined,
                  offset,
                ),
              (user) => guild.members.fetch({ user }),
            );
            groupStreak = response.groupStreak;
            entries = await Promise.all(
              response.entries.map(async ({ entry: e, member }, i) => {
                const avatar = await fetchAvatarBuffer(member);
                return {
                  rank: i + 1,
                  displayName: member.displayName,
                  attempts: e.attempts,
                  solved: e.solved,
                  showcase: e.showcase,
                  avatar,
                };
              }),
            );
          } else {
            const response = await collectVerifiedLeaderboard(
              (offset) =>
                api.getWordleLeaderboard(
                  interaction.guildId!,
                  period,
                  undefined,
                  offset,
                ),
              (user) => guild.members.fetch({ user }),
            );
            groupStreak = response.groupStreak;
            const ranks = denseRanks(
              response.entries.map(
                ({ entry: e }) => `${e.avgScore}:${e.totalDays}`,
              ),
            );
            entries = await Promise.all(
              response.entries.map(async ({ entry: e, member }, i) => {
                const avatar = await fetchAvatarBuffer(member);
                return {
                  rank: ranks[i],
                  displayName: member.displayName,
                  avgScore: e.avgScore,
                  totalDays: e.totalDays,
                  showcase: e.showcase,
                  avatar,
                };
              }),
            );
          }

          const buffer = await buildTermoLeaderboardImage(
            entries,
            period,
            groupStreak,
          );
          const attachment = new AttachmentBuilder(buffer, {
            name: 'terminhos-ranking.png',
          });

          const embed = baseEmbed(this.container.client)
            .setColor(0x588157)
            .setImage('attachment://terminhos-ranking.png');

          await interaction.editReply({
            embeds: [embed],
            files: [attachment],
          });
        } catch (err) {
          logger.error('admin termo leaderboard: Error fetching ranking:', err);
          await interaction.editReply({
            content: '❌ Erro ao buscar o ranking.',
          });
        }
        return;
      }
    }

    if (subgroup === 'wordlist') {
      if (sub === 'review') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
          const response = await api.getNextWordlistReviewWord();
          await interaction.editReply({
            content: buildWordlistReviewContent(response.data),
            components: response.data.done
              ? []
              : [buildWordlistReviewActionRow()],
          });
        } catch (err) {
          logger.warn('admin wordlist review: Error fetching next word:', err);
          await interaction.editReply({
            content: '❌ Erro ao buscar a próxima palavra.',
          });
        }
        return;
      }
    }
  }

  private async handleStatus(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const start = performance.now();
    const apiOnline = await api.healthCheck();
    const latencyMs = Math.round(performance.now() - start);

    const debugInfo = GameManager.getInstance().debugInfo();
    const sessionsByType = debugInfo.sessions.reduce<Record<string, number>>(
      (acc, s) => {
        acc[s.type] = (acc[s.type] ?? 0) + 1;
        return acc;
      },
      {},
    );
    const sessionsSummary =
      Object.keys(sessionsByType).length > 0
        ? Object.entries(sessionsByType)
            .map(([type, count]) => `${type}: ${count}`)
            .join(', ')
        : 'Nenhuma sessão ativa';

    const recentErrors = getRecentErrors();
    const errorsSummary =
      recentErrors.length > 0
        ? recentErrors
            .slice(-5)
            .map(
              (e) =>
                `[${e.logLevel}] ${e.origin} (${e.timestamp.toLocaleTimeString('pt-BR')})`,
            )
            .join('\n')
        : 'Nenhum erro nos últimos 15 minutos';

    const uptimeSeconds = Math.round(process.uptime());
    const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

    const embed = baseEmbed(this.container.client)
      .setTitle('Status do Marquinhos')
      .addFields(
        {
          name: 'API',
          value: apiOnline ? `✅ Online (${latencyMs}ms)` : '❌ Offline',
          inline: true,
        },
        {
          name: 'Ping Discord',
          value: `${interaction.client.ws.ping}ms`,
          inline: true,
        },
        {
          name: 'Uptime',
          value: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`,
          inline: true,
        },
        { name: 'Memória', value: `${memoryMb}MB`, inline: true },
        {
          name: `Sessões ativas (${debugInfo.activeSessions})`,
          value: sessionsSummary,
        },
        {
          name: `Erros recentes (${recentErrors.length})`,
          value: errorsSummary,
        },
      )
      .setColor(0x588157);

    await interaction.editReply({ embeds: [embed] });
  }
}
