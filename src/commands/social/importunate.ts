import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { Command } from '@sapphire/framework';
import { joinVoiceChannel } from 'discord-player';
import { GuildMember } from 'discord.js';

export class ImportunateCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'importunar', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription(
          'Eu vou lá no canal de voz atazanar a vida de quem tu quiser.',
        )
        .addUserOption((option) =>
          option
            .setName('importunado')
            .setDescription('Quem você quer que eu irrite?')
            .setRequired(true),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const member = interaction.options.getMember(
      'importunado',
    ) as GuildMember | null;

    await interaction.deferReply({ ephemeral: true });

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
        connection.disconnect();
        connection.destroy();
      }, 3000);
    } else {
      await interaction.editReply({
        content: 'Acho que essa pessoa aí não tá num canal de voz..',
      });
    }
  }
}
