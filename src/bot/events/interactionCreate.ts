import { handleCommandInteraction } from '@marquinhos/bot/handlers/commandHandler';
import { handleButtonInteraction } from '@marquinhos/bot/handlers/gameButtonHandler';
import { handleModalSubmitInteraction } from '@marquinhos/bot/handlers/gameModalHandler';
import { handleAutocompleteInteraction } from '@marquinhos/bot/handlers/autocompleteHandler';
import { BotEvent } from '@marquinhos/types';
import { Interaction } from 'discord.js';

export const interactionCreate: BotEvent = {
  name: 'interactionCreate',
  execute: async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      await handleCommandInteraction(interaction);
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmitInteraction(interaction);
    } else if (interaction.isAutocomplete()) {
      await handleAutocompleteInteraction(interaction);
    }
  },
};
