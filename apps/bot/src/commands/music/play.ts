import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { Command } from '@sapphire/framework';
import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
} from 'discord.js';
import { handlePlay } from './utils';

export class PlayCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, {
      name: 'play',
      preconditions: [
        'UserInVoiceChannel',
        'BotNotInOtherChannel',
        'CanSpeak',
        'CanJoin',
      ],
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Toca uma música')
        .addStringOption((option) =>
          option
            .setName('musica')
            .setDescription('A música a ser tocada')
            .setRequired(true),
        ),
    );
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const voiceChannel = (interaction.member as GuildMember).voice.channel!;
    const memberId = (interaction.member as GuildMember).id;
    const guildId = interaction.guildId!;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const musicQuery = interaction.options.getString('musica', true);
    const response = await handlePlay(
      musicQuery,
      guildId,
      interaction.channel!,
      voiceChannel,
      memberId,
    );

    await interaction.editReply(response);
  }
}
