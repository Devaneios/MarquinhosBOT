import type { WordleAchievementsOverview } from '@marquinhos/contracts/wordle';
import {
  buildTermoAchievementDetailEmbed,
  buildTermoAchievementsEmbed,
  summarizeTermoAchievements,
} from '@marquinhos/formatters/termoAchievements';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  buildTermoAchievementDetailImage,
  buildTermoAchievementsImage,
} from '@marquinhos/ui/screens/termo';
import type { BaseEmbedClient } from '@marquinhos/utils/discord';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import {
  AttachmentBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
} from 'discord.js';

const api = MarquinhosApiService.getInstance();

export interface TermoAchievementsTarget {
  id: string;
  displayName: string;
  avatarUrl: string;
}

export interface TermoAchievementsReply {
  embeds: EmbedBuilder[];
  files: AttachmentBuilder[];
}

export async function buildTermoAchievementsReply(
  client: BaseEmbedClient,
  guildId: string,
  target: TermoAchievementsTarget,
  apiService: Pick<MarquinhosApiService, 'getWordleAchievements'> = api,
  selection?: string,
): Promise<TermoAchievementsReply> {
  const response = await apiService.getWordleAchievements(target.id, guildId);
  const overview: WordleAchievementsOverview = response.data;
  if (selection !== undefined) {
    const query = selection.trim().toLocaleLowerCase('pt-BR');
    const achievement = overview.achievements.find(
      (entry) =>
        entry.id.toLocaleLowerCase('pt-BR') === query ||
        (!(entry.hidden && entry.unlockedAt === null) &&
          entry.name.toLocaleLowerCase('pt-BR') === query),
    );
    if (achievement === undefined) {
      return {
        embeds: [
          baseEmbed(client)
            .setTitle('Conquista não encontrada')
            .setDescription(
              'Use o Nome ou ID completo em `/termo-conquistas conquista:`. Consulte a coleção no Terminhos para escolher uma conquista.',
            ),
        ],
        files: [],
      };
    }
    if (achievement.hidden && achievement.unlockedAt === null) {
      return {
        embeds: [buildTermoAchievementDetailEmbed(client, target, achievement)],
        files: [],
      };
    }
    const hasDrawing =
      Boolean(achievement.matchEvidence) ||
      achievement.patternPreview !== undefined;
    const imageName = `termo-conquista-${target.id}.png`;
    const image = hasDrawing
      ? await buildTermoAchievementDetailImage({
          displayName: target.displayName,
          achievement,
        })
      : null;
    return {
      embeds: [
        buildTermoAchievementDetailEmbed(
          client,
          target,
          achievement,
          image === null ? undefined : imageName,
        ),
      ],
      files:
        image === null
          ? []
          : [new AttachmentBuilder(image, { name: imageName })],
    };
  }
  const summary = summarizeTermoAchievements(overview.achievements);
  const imageName = `termo-conquistas-${target.id}.png`;
  const image = await buildTermoAchievementsImage({
    displayName: target.displayName,
    stats: overview.stats,
    unlocked: summary.unlocked,
    total: summary.total,
    families: summary.families,
  });
  return {
    embeds: [buildTermoAchievementsEmbed(client, target, overview, imageName)],
    files: [new AttachmentBuilder(image, { name: imageName })],
  };
}

export class TermoAchievementsCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'termo-conquistas', cooldownDelay: 5_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Veja as conquistas e estatísticas do Terminhos')
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setDescription('Pessoa para ver as conquistas (opcional)')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('conquista')
            .setDescription(
              'Nome ou ID da conquista para ver o desenho e os detalhes',
            )
            .setRequired(false),
        ),
    );
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: '❌ As conquistas do Terminhos só existem em servidores.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const user = interaction.options.getUser('usuario') ?? interaction.user;
    if (user.bot) {
      await interaction.reply({
        content: '🤖 Bots não jogam o Terminhos.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    try {
      const reply = await buildTermoAchievementsReply(
        this.container.client,
        interaction.guildId,
        {
          id: user.id,
          displayName: member?.displayName ?? user.displayName,
          avatarUrl: (member ?? user).displayAvatarURL(),
        },
        api,
        interaction.options.getString('conquista') ?? undefined,
      );
      await interaction.editReply(reply);
    } catch (error) {
      logger.error('Termo: failed to build achievements reply:', error);
      await interaction.editReply({
        content: '❌ Não foi possível carregar as conquistas do Terminhos.',
      });
    }
  }
}
