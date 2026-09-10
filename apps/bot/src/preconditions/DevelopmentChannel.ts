import { isDevelopmentChannelAllowed } from '@marquinhos/config/developmentScope';
import { Precondition } from '@sapphire/framework';
import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js';

export class DevelopmentChannelPrecondition extends Precondition {
  constructor(context: Precondition.LoaderContext) {
    super(context, { position: 0 });
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (isDevelopmentChannelAllowed(interaction)) return this.ok();
    await interaction.reply({
      content: 'Use o canal de testes para este bot de desenvolvimento.',
      flags: MessageFlags.Ephemeral,
    });
    return this.error({ message: 'Outside the development test channel' });
  }
}
