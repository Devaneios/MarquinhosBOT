import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import {
  buildThreadName,
  runThreadTurn,
  type AiThreadChannel,
} from '@marquinhos/services/aiChat/aiThread';
import { followResearchJob } from '@marquinhos/services/aiChat/researchProgress';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import {
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  ThreadAutoArchiveDuration,
} from 'discord.js';

const apiService = MarquinhosApiService.getInstance();

const ASK_PREFIX = '💭';
const RESEARCH_PREFIX = '🔬';
/** Threads live a day of inactivity; long enough to come back to an answer. */
const AUTO_ARCHIVE = ThreadAutoArchiveDuration.OneDay;

/**
 * Channel types that can hold threads. Voice and forum channels cannot, and a
 * thread cannot itself hold a thread.
 */
const THREADABLE = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export class IaCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'ia', cooldownDelay: 0 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Fala com a IA do Marquinhos numa thread dedicada')
        .addSubcommand((sub) =>
          sub
            .setName('perguntar')
            .setDescription(
              'Abre uma thread e responde sua pergunta, mantendo o contexto da conversa',
            )
            .addStringOption((opt) =>
              opt
                .setName('pergunta')
                .setDescription('O que você quer saber')
                .setRequired(true)
                .setMaxLength(1000),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('pesquisar')
            .setDescription(
              'Pesquisa profunda: busca na web, lê as páginas e entrega um relatório com fontes',
            )
            .addStringOption((opt) =>
              opt
                .setName('tema')
                .setDescription('O tema que você quer que eu pesquise')
                .setRequired(true)
                .setMaxLength(500),
            ),
        ),
    );
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Esse comando só funciona em servidor.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.channel;
    if (!channel || !THREADABLE.includes(channel.type)) {
      await interaction.reply({
        content:
          'Só consigo abrir thread em canal de texto normal. Chama o comando num canal de texto.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'perguntar') {
      await this.ask(interaction);
      return;
    }
    await this.research(interaction);
  }

  private async ask(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString('pergunta', true);
    await interaction.deferReply();

    const thread = await this.openThread(
      interaction,
      buildThreadName(ASK_PREFIX, question),
      `${interaction.user} perguntou:\n> ${question}`,
    );
    if (!thread) return;

    await runThreadTurn(thread, interaction.user.id, question, apiService);
  }

  private async research(interaction: ChatInputCommandInteraction) {
    const topic = interaction.options.getString('tema', true);
    await interaction.deferReply();

    const thread = await this.openThread(
      interaction,
      buildThreadName(RESEARCH_PREFIX, topic),
      `${interaction.user} pediu uma pesquisa profunda sobre:\n> ${topic}\n\nIsso leva alguns minutos. Vou postando o progresso aqui.`,
    );
    if (!thread) return;

    let start;
    try {
      start = (
        await apiService.startResearch({
          threadId: thread.id,
          guildId: interaction.guildId!,
          channelId: interaction.channelId,
          userId: interaction.user.id,
          query: topic,
          // The interaction id is unique per command invocation, so an HTTP
          // retry cannot start a second eight-minute job.
          idempotencyKey: interaction.id,
        })
      ).data;
    } catch (error) {
      logger.error(
        `[ai-chat] não consegui iniciar a pesquisa thread=${thread.id}: ${(error as Error).message}`,
      );
      await thread.send('Não consegui iniciar a pesquisa. Tenta de novo.');
      return;
    }

    if (start.status === 'rate_limited') {
      await thread.send(
        'Você já gastou suas pesquisas profundas de hoje. Cada uma custa caro, volta amanhã.',
      );
      return;
    }
    if (start.status === 'rejected') {
      await thread.send(start.reply ?? 'Manda um tema de pesquisa de verdade.');
      return;
    }
    if (!start.jobId) {
      await thread.send('Não consegui iniciar a pesquisa. Tenta de novo.');
      return;
    }

    await followResearchJob(thread, start.jobId, { apiService });
  }

  /**
   * Creates the thread off the deferred reply so the conversation hangs under a
   * visible message, and reports failure in the reply rather than silently.
   */
  private async openThread(
    interaction: ChatInputCommandInteraction,
    name: string,
    intro: string,
  ): Promise<AiThreadChannel | null> {
    try {
      const anchor = await interaction.editReply(intro);
      const thread = await anchor.startThread({
        name,
        autoArchiveDuration: AUTO_ARCHIVE,
      });
      return thread as unknown as AiThreadChannel;
    } catch (error) {
      logger.error(
        `[ai-chat] não consegui abrir a thread: ${(error as Error).message}`,
      );
      await interaction
        .editReply(
          'Não consegui abrir a thread aqui. Confere se eu tenho permissão de criar thread neste canal.',
        )
        .catch(() => null);
      return null;
    }
  }
}
