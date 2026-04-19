import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { Command } from '@sapphire/framework';
import { Track, useQueue } from 'discord-player';
import { ChatInputCommandInteraction } from 'discord.js';

export class QueueCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, {
      name: 'fila',
      preconditions: ['BotNotInOtherChannel'],
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Mostra a fila de músicas'),
    );
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guildId!);

    if (!queue) {
      await interaction.reply(
        'Este servidor não tem uma sessão de player ativa.',
      );
      return;
    }

    const currentTrack = queue.currentTrack;

    if (!currentTrack) {
      await interaction.reply('Não há nenhuma faixa tocando.');
      return;
    }

    const upcomingTracks = queue.tracks.toArray().slice(0, 5);

    const message = [
      `**Tocando Agora:** ${currentTrack.title} - ${currentTrack.author}`,
      '',
      '**Próximas Faixas:**',
      ...upcomingTracks.map(
        (track: Track, index: number) =>
          `${index + 1}. ${track.title} - ${track.author}`,
      ),
    ].join('\n');

    await interaction.reply(message);
  }
}
