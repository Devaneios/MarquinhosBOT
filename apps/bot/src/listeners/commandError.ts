import { logger } from '@marquinhos/utils/logger';
import { Events, Listener } from '@sapphire/framework';
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from 'discord.js';
import { DiscordAPIError } from 'discord.js';

interface CommandErrorPayload {
  command: { name: string };
  interaction: ChatInputCommandInteraction;
}

interface AutocompleteErrorPayload {
  command: { name: string };
  interaction: AutocompleteInteraction;
}

function formatError(error: unknown, prefix: string): string {
  const parts = [
    prefix,
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  ];
  if (error instanceof DiscordAPIError) {
    parts.push(`RequestBody: ${JSON.stringify(error.requestBody)}`);
    parts.push(`RawError: ${JSON.stringify(error.rawError)}`);
  }
  return parts.join('\n');
}

export class ChatInputCommandErrorListener extends Listener<
  typeof Events.ChatInputCommandError
> {
  public constructor(context: Listener.LoaderContext) {
    super(context, { event: Events.ChatInputCommandError });
  }

  public run(error: unknown, { command, interaction }: CommandErrorPayload) {
    const prefix = [
      `Command error in /${command.name}`,
      `User: ${interaction.user.tag} (${interaction.user.id})`,
      `Guild: ${interaction.guildId} | Channel: ${interaction.channelId}`,
    ].join(' | ');
    logger.error(formatError(error, prefix));
  }
}

export class AutocompleteInteractionErrorListener extends Listener<
  typeof Events.CommandAutocompleteInteractionError
> {
  public constructor(context: Listener.LoaderContext) {
    super(context, { event: Events.CommandAutocompleteInteractionError });
  }

  public run(
    error: unknown,
    { command, interaction }: AutocompleteErrorPayload,
  ) {
    const prefix = [
      `Autocomplete error in /${command.name}`,
      `User: ${interaction.user.tag} (${interaction.user.id})`,
      `Guild: ${interaction.guildId} | Channel: ${interaction.channelId}`,
    ].join(' | ');
    logger.error(formatError(error, prefix));
  }
}
