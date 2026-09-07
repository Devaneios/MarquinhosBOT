import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { handlePlay } from './utils';

export class PlayNextCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, {
      name: 'adicionar-a-fila',
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
        .setDescription('Adiciona uma música ao topo da fila')
        .addStringOption((option) =>
          option
            .setName('musica')
            .setDescription('A música a ser tocada')
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option
            .setName('posicao')
            .setDescription('A posição que a música deve ser adicionada'),
        ),
    );
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const voiceChannel = (interaction.member as GuildMember).voice.channel!;
    const memberId = (interaction.member as GuildMember).id;
    const guildId = interaction.guildId!;

    await interaction.deferReply();

    const musicQuery = interaction.options.getString('musica', true);
    const response = await handlePlay(
      musicQuery,
      guildId,
      interaction.channel!,
      voiceChannel,
      memberId,
      true,
    );

    await interaction.editReply(response);
  }
}
