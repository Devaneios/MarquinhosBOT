import { getVoiceConnection } from '@discordjs/voice';
import { commandDefinitions } from '@marquinhos/lib/commandDefinitions';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { resolveGuildMember } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';
import { joinVoiceChannel } from 'discord-player';
import { MessageFlags } from 'discord.js';

export class ImportunateCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, commandDefinitions['importunar']);
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const member = resolveGuildMember(
      interaction.options.getMember('importunado'),
    );

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!member) {
      await interaction.editReply({
        content: '❌ Usuário não encontrado.',
      });
      return;
    }

    if (member.user.bot) {
      await interaction.editReply({
        content: 'Nunca vou conseguir irritar um bot',
      });
      return;
    }

    if (getVoiceConnection(member.guild.id)) {
      await interaction.editReply({
        content: 'Já estou conectado a um canal de voz neste servidor.',
      });
      return;
    }

    if (member.voice.channel) {
      const connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId: member.guild.id,
        adapterCreator: member.guild.voiceAdapterCreator,
      });
      await interaction.editReply({
        content: `Pronto, já tô lá no canal de voz irritando a vida do ${member.user.tag}!`,
      });
      setTimeout(() => {
        try {
          connection.disconnect();
          connection.destroy();
        } catch {
          // Connection may already be destroyed or disconnected.
        }
      }, 3000);
    } else {
      await interaction.editReply({
        content: 'Acho que essa pessoa aí não tá num canal de voz..',
      });
    }
  }
}
