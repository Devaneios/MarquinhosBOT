import { useMainPlayer } from 'discord-player';
import { AutocompleteInteraction, CommandInteraction, Guild } from 'discord.js';
import { BotEvent } from '@marquinhos/types';
import BotError from '@marquinhos/utils/botError';
import { logger } from '@marquinhos/utils/logger';
import { XPSystem } from '@marquinhos/utils/xpSystem';

export const interactionCreate: BotEvent = {
  name: 'interactionCreate',
  execute: async (interaction: CommandInteraction) => {
    if (interaction.isChatInputCommand()) {
      const timedMessageDuration = 10000;
      const command = interaction.client.slashCommands.get(
        interaction.commandName,
      );
      const cooldown = interaction.client.cooldowns.get(
        `${interaction.commandName}-${interaction.user.username}`,
      );
      if (!command) return;
      if (command.cooldown && cooldown) {
        if (Date.now() < cooldown) {
          interaction.reply(
            `Vai com calma! Você pode usar esse comando novamente daqui ${Math.floor(
              Math.abs(Date.now() - cooldown) / 1000,
            )} segundos.`,
          );
          setTimeout(() => interaction.deleteReply(), timedMessageDuration);
          return;
        }
        interaction.client.cooldowns.set(
          `${interaction.commandName}-${interaction.user.username}`,
          Date.now() + command.cooldown * 1000,
        );
        setTimeout(() => {
          interaction.client.cooldowns.delete(
            `${interaction.commandName}-${interaction.user.username}`,
          );
        }, command.cooldown * 1000);
      } else if (command.cooldown && !cooldown) {
        interaction.client.cooldowns.set(
          `${interaction.commandName}-${interaction.user.username}`,
          Date.now() + command.cooldown * 1000,
        );
      }

      logger.info(
        `${interaction.user.username} executing command: ${
          interaction.commandName
        } ${
          interaction.options
            ? interaction.options.data.map((option) => option.value).join(' ')
            : ''
        }`,
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

      player.context.provide(data, async () => {
        await command.execute(interaction);

        // Add XP for command usage
        await XPSystem.addCommandXP(interaction);

        // Check for level up notification
        setTimeout(async () => {
          await XPSystem.checkAndNotifyLevelUp(
            interaction.user.id,
            interaction.guildId!,
            interaction,
          );
        }, 2000);
      });
    } else if (interaction.isAutocomplete()) {
      const command = (
        interaction as AutocompleteInteraction
      ).client.slashCommands.get(
        (interaction as AutocompleteInteraction).commandName,
      );
      if (!command) {
        throw new BotError(
          `No command matching ${(interaction as AutocompleteInteraction).commandName} was found.`,
          interaction,
          'error',
        );
      }
      try {
        if (!command.autocomplete) return;
        command.autocomplete(interaction);
      } catch (error: unknown) {
        throw new BotError(
          `An error occurred while executing the autocomplete for ${(interaction as AutocompleteInteraction).commandName}.
Error: ${(error as Error).message}`,
          interaction,
          'error',
        );
      }
    }
  },
};
