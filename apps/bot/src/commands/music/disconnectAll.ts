import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed, requireGuildMember } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import { PermissionsBitField } from 'discord.js';

export class DisconnectAllCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'encerrar-chamada', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Remove todo mundo da chamada atual')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const member = requireGuildMember(interaction.member, interaction);
    const voiceChannel = member.voice.channel;
    const embed = baseEmbed(this.container.client);
    if (!voiceChannel) {
      await interaction.reply({
        embeds: [
          embed.setDescription(
            'Você precisa estar em um canal de voz para usar esse comando',
          ),
        ],
      });
      return;
    }

    await interaction.deferReply();

    const results = await Promise.allSettled(
      [...voiceChannel.members.values()].map((user) =>
        user.voice.setChannel(null),
      ),
    );

    const failed = results.filter(
      (result) => result.status === 'rejected',
    ).length;
    if (failed > 0) {
      logger.warn(`disconnectAll: ${failed} member(s) could not be removed`);
    }

    await interaction.editReply({
      embeds: [
        embed.setDescription(
          failed > 0
            ? `Desconectei quem deu. ${failed} usuário(s) não puderam ser removidos.`
            : 'Todos os usuários foram desconectados',
        ),
      ],
    });
  }
}
