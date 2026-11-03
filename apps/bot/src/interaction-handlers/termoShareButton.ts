import { buildTermoAchievementsReply } from '@marquinhos/commands/games/termoAchievements';
import {
  parseShareButtonId,
  selectShareAchievement,
} from '@marquinhos/commands/games/termoShare';
import { isDevelopmentChannelAllowed } from '@marquinhos/config/developmentScope';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { logger } from '@marquinhos/utils/logger';
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ButtonInteraction,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';

const api = MarquinhosApiService.getInstance();
const pending = new Set<string>();

export class TermoShareButtonHandler extends InteractionHandler {
  constructor(context: InteractionHandler.LoaderContext) {
    super(context, { interactionHandlerType: InteractionHandlerTypes.Button });
  }
  override parse(interaction: ButtonInteraction) {
    if (!isDevelopmentChannelAllowed(interaction)) return this.none();
    const parsed = parseShareButtonId(interaction.customId);
    return parsed ? this.some(parsed) : this.none();
  }
  override async run(
    interaction: ButtonInteraction,
    selection: NonNullable<ReturnType<typeof parseShareButtonId>>,
  ) {
    if (
      !interaction.guild ||
      !interaction.guildId ||
      interaction.user.id !== selection.userId
    ) {
      await interaction.reply({
        content: '❌ Esta prévia pertence a outra pessoa.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (pending.has(interaction.message.id)) {
      await interaction.reply({
        content: 'A publicação já está em andamento.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    pending.add(interaction.message.id);
    try {
      await interaction.deferUpdate();
      await interaction.editReply({ components: [] });
      const channel = await interaction.guild.channels.fetch(
        selection.channelId,
      );
      if (!channel || channel.type !== ChannelType.GuildText)
        throw new Error('Destination unavailable');
      if (
        !channel
          .permissionsFor(interaction.user.id)
          ?.has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ])
      )
        throw new Error('User cannot publish in destination');
      const overview = await api.getWordleAchievements(
        interaction.user.id,
        interaction.guildId,
      );
      if (
        !selectShareAchievement(
          overview.data.achievements,
          selection.achievementId,
        )
      )
        throw new Error('Achievement not unlocked');
      const member = await interaction.guild.members
        .fetch(interaction.user.id)
        .catch(() => null);
      const user = member ?? interaction.user;
      const reply = await buildTermoAchievementsReply(
        interaction.client,
        interaction.guildId,
        {
          id: interaction.user.id,
          displayName: member?.displayName ?? interaction.user.displayName,
          avatarUrl: user.displayAvatarURL(),
        },
        api,
        selection.achievementId,
      );
      await channel.send(reply);
      await interaction.editReply({
        content: `✅ Conquista publicada em <#${channel.id}>.`,
      });
    } catch (error) {
      logger.warn('termo share publication failed', error);
      await interaction.editReply({
        content:
          '❌ Não foi possível confirmar a publicação. Confira o canal antes de tentar novamente.',
        components: [],
      });
    } finally {
      pending.delete(interaction.message.id);
    }
  }
}
