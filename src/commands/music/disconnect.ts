import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';
import { PermissionsBitField } from 'discord.js';

export class DisconnectCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'desconectar', cooldownDelay: 5_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Remove uma pessoa específica do canal de voz')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers)
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setDescription('O usuário que será desconectado')
            .setRequired(true),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const targetUser = interaction.options.getUser('usuario');
    const disconnectEmbed = baseEmbed(this.container.client);

    if (!targetUser) {
      await interaction.reply({
        embeds: [disconnectEmbed.setDescription('Usuário não encontrado.')],
      });
      return;
    }

    const member = await interaction.guild?.members.fetch(targetUser.id);
    if (!member) {
      await interaction.reply({
        embeds: [
          disconnectEmbed.setDescription(
            'Não foi possível encontrar o membro no servidor.',
          ),
        ],
      });
      return;
    }

    if (!member.voice.channel) {
      await interaction.reply({
        embeds: [
          disconnectEmbed.setDescription(
            'Este usuário não está em um canal de voz.',
          ),
        ],
      });
      return;
    }

    try {
      await member.voice.setChannel(null);
      await interaction.reply({
        embeds: [
          disconnectEmbed.setDescription(
            `${member.user.username} foi desconectado do canal de voz.`,
          ),
        ],
      });
    } catch (_error) {
      await interaction.reply({
        embeds: [
          disconnectEmbed.setDescription(
            'Não foi possível desconectar o usuário. Verifique se tenho as permissões necessárias.',
          ),
        ],
      });
    }
  }
}
