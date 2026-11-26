import { commandDefinitions } from '@marquinhos/lib/commandDefinitions';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { requireGuildMember } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { handlePlay } from './utils';

export class PlayCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, commandDefinitions['play']);
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const member = requireGuildMember(interaction.member, interaction);
    const voiceChannel = member.voice.channel!;
    const memberId = member.id;
    const guildId = interaction.guildId!;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.channel;
    if (!channel?.isSendable()) {
      await interaction.editReply('Não consigo enviar mensagens neste canal.');
      return;
    }

    const musicQuery = interaction.options.getString('musica', true);
    const response = await handlePlay(
      musicQuery,
      guildId,
      channel,
      voiceChannel,
      memberId,
    );

    await interaction.editReply(response);
  }
}
