import { logger } from '@marquinhos/utils/logger';
import { AutocompleteInteraction } from 'discord.js';

export async function handleAutocompleteInteraction(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const command = interaction.client.slashCommands.get(interaction.commandName);

  if (!command?.autocomplete) {
    // Discord requires a response to every autocomplete — send empty choices
    // rather than throwing, which would leave the interaction unresolved.
    await interaction.respond([]);
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error: unknown) {
    logger.error(
      `Autocomplete error for ${interaction.commandName}: ${(error as Error).message}`,
    );
    // Best-effort response; the interaction token may have already expired.
    try {
      await interaction.respond([]);
    } catch {
      // Already responded or expired — nothing to do.
    }
  }
}
