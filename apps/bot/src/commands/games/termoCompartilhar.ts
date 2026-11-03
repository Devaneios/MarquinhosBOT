import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import { buildTermoAchievementsReply } from './termoAchievements';
import { buildShareButtonId, selectShareAchievement } from './termoShare';

const api = MarquinhosApiService.getInstance();
export class TermoCompartilharCommand extends MarquinhosCommand {
  constructor(context: Command.LoaderContext) {
    super(context, { name: 'termo-compartilhar', cooldownDelay: 5000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Prévia para compartilhar uma conquista do Terminhos')
        .addStringOption((option) =>
          option
            .setName('conquista')
            .setDescription('Nome ou ID de uma conquista desbloqueada')
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal onde publicar após confirmar')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: '❌ Use este comando em um servidor.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const channel = interaction.options.getChannel('canal', true);
      const overview = await api.getWordleAchievements(
        interaction.user.id,
        interaction.guildId,
      );
      const id = selectShareAchievement(
        overview.data.achievements,
        interaction.options.getString('conquista', true),
      );
      if (!id) {
        await interaction.editReply({
          content: '❌ Escolha uma conquista que você já desbloqueou.',
        });
        return;
      }
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
        id,
      );
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(buildShareButtonId(interaction.user.id, channel.id, id))
          .setLabel('Publicar neste canal')
          .setStyle(ButtonStyle.Primary),
      );
      await interaction.editReply({
        content: `Prévia para <#${channel.id}>. Confira e confirme a publicação.`,
        ...reply,
        components: [row],
      });
    } catch (error) {
      logger.warn('termo share preview failed', error);
      await interaction.editReply({
        content: '❌ Não foi possível preparar a prévia.',
      });
    }
  }
}
