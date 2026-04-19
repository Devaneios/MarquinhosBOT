import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { resourcePath } from '@marquinhos/utils/resources';
import { Command } from '@sapphire/framework';
import { readdirSync } from 'fs';

const audiosDir = resourcePath('sounds');
const audios: string[] = [];

readdirSync(audiosDir).forEach((file) => {
  try {
    if (!file.endsWith('.mp3') || file.startsWith('_')) return;
    audios.push(file.replace('.mp3', ''));
    logger.info(`Successfully loaded audio ${file.replace('.mp3', '')}`);
  } catch {
    logger.error(`Error loading audio ${file.replace('.mp3', '')}`);
  }
});

export class AudioCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'audio', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Reproduz um áudio')
        .addStringOption((option) =>
          option
            .setName('audio')
            .setDescription('Áudio a ser reproduzido')
            .setRequired(true)
            .addChoices(...audios.map((a) => ({ name: a, value: a }))),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const file = interaction.options.getString('audio', true);
    const embed = baseEmbed(this.container.client).setDescription(
      `Reproduzindo ${file}`,
    );
    return interaction.reply({ embeds: [embed] });
  }
}
