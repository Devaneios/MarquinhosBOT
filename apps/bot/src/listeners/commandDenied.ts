import {
  Events,
  Identifiers,
  Listener,
  type ChatInputCommandDeniedPayload,
  type UserError,
} from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

// Sapphire does not answer a denied command, so without this the user sees
// "the application did not respond" instead of the precondition's message.
export class ChatInputCommandDeniedListener extends Listener<
  typeof Events.ChatInputCommandDenied
> {
  public constructor(context: Listener.LoaderContext) {
    super(context, { event: Events.ChatInputCommandDenied });
  }

  public async run(
    error: UserError,
    { interaction }: ChatInputCommandDeniedPayload,
  ) {
    // A precondition may answer on its own (DevelopmentChannel does).
    if (interaction.replied || interaction.deferred) return;
    await interaction.reply({
      content: deniedMessage(error),
      flags: MessageFlags.Ephemeral,
    });
  }
}

function deniedMessage(error: UserError): string {
  if (error.identifier !== Identifiers.PreconditionCooldown) {
    return error.message;
  }
  const { remaining } = error.context as { remaining: number };
  return `Calma! Tente de novo em ${Math.ceil(remaining / 1000)}s.`;
}
