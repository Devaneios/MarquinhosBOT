import { env } from '@marquinhos/config/environment';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';

export class LastfmCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'lastfm', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Mostra informações sobre a integração com o last.fm'),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const lastfmEmbed = baseEmbed(this.container.client);
    interaction.reply({
      embeds: [
        lastfmEmbed
          .setThumbnail(
            'https://play-lh.googleusercontent.com/VFmAfWqcuV3aReZG8MMQdHRSdKWx85IW22f4RQ5xhR5U-o1_u03P7TVwsnTYa26Q1No',
          )
          .setDescription(
            `
        O marquinhos agora é integrado com o last.fm, para que seja possível registrar as músicas que você escuta nos bots de música.\n\n
        Entre em [Marquinhos Web](${env.MARQUINHOS_WEB_URL}) para configurar a sua conta!
        `,
          )
          .setTitle('Integração com o last.fm'),
      ],
    });
  }
}
