import { commandDefinitions } from '@marquinhos/lib/commandDefinitions';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { Command } from '@sapphire/framework';
import { useQueue } from 'discord-player';
import { ChatInputCommandInteraction } from 'discord.js';

export class ClearQueueCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, commandDefinitions['limpar-fila']);
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guildId!);

    if (!queue) {
      interaction.reply('Não existem músicas na fila.');
      return;
    }

    queue.clear();

    interaction.reply('A fila de músicas foi limpa.');
  }
}
