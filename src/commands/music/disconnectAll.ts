import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';
import { GuildMember, PermissionsBitField } from 'discord.js';

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
    const member = interaction.member as GuildMember;
    const voiceChannel = member?.voice.channel;
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

    const activeUsers = voiceChannel.members.values();
    for (const user of activeUsers) {
      await user.voice.setChannel(null);
    }

    await interaction.reply({
      embeds: [embed.setDescription('Todos os usuários foram desconectados')],
    });
  }
}
