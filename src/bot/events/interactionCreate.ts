import { Guild, Interaction } from 'discord.js';

import { BotEvent, SafeAny } from '@marquinhos/types';
import BotError from '@marquinhos/utils/botError';
import { logger } from '@marquinhos/utils/logger';
import { useMainPlayer } from 'discord-player';

export const interactionCreate: BotEvent = {
  name: 'interactionCreate',
  execute: async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      const timedMessageDuration = 10000;
      const command = interaction.client.slashCommands.get(
        interaction.commandName
      );
      const cooldown = interaction.client.cooldowns.get(
        `${interaction.commandName}-${interaction.user.username}`
      );
      if (!command) return;
      if (command.cooldown && cooldown) {
        if (Date.now() < cooldown) {
          interaction.reply(
            `Vai com calma! Você pode usar esse comando novamente daqui ${Math.floor(
              Math.abs(Date.now() - cooldown) / 1000
            )} segundos.`
          );
          setTimeout(() => interaction.deleteReply(), timedMessageDuration);
          return;
        }
        interaction.client.cooldowns.set(
          `${interaction.commandName}-${interaction.user.username}`,
          Date.now() + command.cooldown * 1000
        );
        setTimeout(() => {
          interaction.client.cooldowns.delete(
            `${interaction.commandName}-${interaction.user.username}`
          );
        }, command.cooldown * 1000);
      } else if (command.cooldown && !cooldown) {
        interaction.client.cooldowns.set(
          `${interaction.commandName}-${interaction.user.username}`,
          Date.now() + command.cooldown * 1000
        );
      }

      logger.info(
        `${interaction.user.username} executing command: ${
          interaction.commandName
        } ${
          interaction.options
            ? interaction.options.data.map((option) => option.value).join(' ')
            : ''
        }`
      );
      if (command.validators?.length) {
        for (const validator of command.validators) {
          if (!(await validator(interaction))) return;
        }
      }

      const player = useMainPlayer();

      const data = {
        guild: interaction.guild as Guild,
      };

      player.context.provide(data, () => command.execute(interaction));
    } else if (interaction.isAutocomplete()) {
      const command = interaction.client.slashCommands.get(
        interaction.commandName
      );
      if (!command) {
        throw new BotError(
          `No command matching ${interaction.commandName} was found.`,
          interaction as SafeAny,
          'error'
        );
      }
      try {
        if (!command.autocomplete) return;
        command.autocomplete(interaction);
      } catch (error) {
        throw new BotError(
          `An error occurred while executing the autocomplete for ${interaction.commandName}.`,
          interaction as SafeAny,
          'error'
        );
      }
    }
  },
};
