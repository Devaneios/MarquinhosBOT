import { logger } from '@marquinhos/utils/logger';
import { Events, Listener } from '@sapphire/framework';
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from 'discord.js';

interface CommandErrorPayload {
  command: { name: string };
  interaction: ChatInputCommandInteraction;
}

interface AutocompleteErrorPayload {
  command: { name: string };
  interaction: AutocompleteInteraction;
}

type DiscordAPIErr = Error & {
  code?: number;
  requestBody?: unknown;
  rawError?: unknown;
};

function formatError(error: unknown, prefix: string): string {
  const err = error as DiscordAPIErr;
  const parts = [prefix, err.stack ?? String(error)];
  if (err.requestBody !== undefined) {
    parts.push(`RequestBody: ${JSON.stringify(err.requestBody)}`);
  }
  if (err.rawError !== undefined) {
    parts.push(`RawError: ${JSON.stringify(err.rawError)}`);
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
