import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed, requireGuildMember } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import { ChannelType, PermissionsBitField } from 'discord.js';

export class MoveAllCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'mover-todos', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Move todos do canal pra o canal escolhido')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers)
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal escolhido para os membros serem movidos')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const member = requireGuildMember(interaction.member, interaction);
    const voiceChannel = member.voice.channel;
    const newVoiceChannel = interaction.options.getChannel('canal', true, [
      ChannelType.GuildVoice,
    ]);
    const embed = baseEmbed(this.container.client);

    if (!voiceChannel) {
      await interaction.reply({
        embeds: [embed.setDescription('Mas tu nem tá num canal de voz vei :(')],
      });
      return;
    }

    await interaction.deferReply();

    const results = await Promise.allSettled(
      [...voiceChannel.members.values()].map((user) =>
        user.voice.setChannel(newVoiceChannel),
      ),
    );

    const failed = results.filter(
      (result) => result.status === 'rejected',
    ).length;
    if (failed > 0) {
      logger.warn(`moveAll: ${failed} member(s) could not be moved`);
    }

    const moved = results.filter(
      (result) => result.status === 'fulfilled',
    ).length;
    await interaction.editReply({
      embeds: [
        embed.setDescription(
          `✅ ${moved} membro(s) movido(s) para ${newVoiceChannel.name}.${failed > 0 ? ` (${failed} falha(s))` : ''}`,
        ),
      ],
    });
  }
}
