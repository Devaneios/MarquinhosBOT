import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import { useQueue } from 'discord-player';
import { ChatInputCommandInteraction } from 'discord.js';

export class SkipCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, {
      name: 'pular',
      preconditions: ['UserInVoiceChannel', 'BotNotInOtherChannel'],
    });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.commandName).setDescription('Pula a música atual'),
    );
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    try {
      const queue = useQueue(interaction.guildId!);

      if (!queue) {
        await interaction.reply('Não há uma sessão de reprodução ativa.');
        return;
      }

      if (!queue.isPlaying()) {
        await interaction.reply('Não há nenhuma música tocando.');
        return;
      }

      queue.node.skip();

      await interaction.reply('A música atual foi pulada.');
    } catch (error) {
      logger.error('Error skipping track:', error);
      await interaction.reply('Ocorreu um erro ao pular a música!');
    }
  }
}
