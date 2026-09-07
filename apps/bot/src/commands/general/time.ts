import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { resourcePath } from '@marquinhos/utils/resources';
import { Command } from '@sapphire/framework';
import { AttachmentBuilder } from 'discord.js';

export class TimeCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'horario', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Eu te digo que horas são. Só isso.....'),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const currentHour = getParsedTime(true);
    const unixTimestamp = Math.floor(Date.now() / 1000);
    const recifeTime = getParsedTime(false);
    const locationTimeEmbed = baseEmbed(this.container.client).setDescription(
      `São ${recifeTime} em Recife e <t:${unixTimestamp}:t> onde quer que você esteja`,
    );
    if (currentHour === '00') {
      const attachment = new AttachmentBuilder(
        resourcePath('images', 'oleodemacaco.png'),
      );
      locationTimeEmbed
        .setTitle('O MACACO ESTÁ DE FÉRIAS')
        .setThumbnail('attachment://oleodemacaco.png');
      interaction.reply({
        files: [attachment],
        embeds: [locationTimeEmbed],
      });
    } else {
      await interaction.reply({
        embeds: [locationTimeEmbed],
      });
    }
  }
}

const getParsedTime = (onlyHour: boolean) => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: onlyHour ? undefined : '2-digit',
    hour12: false,
    timeZone: 'America/Recife',
  };
  return now.toLocaleString('pt-BR', options);
};
