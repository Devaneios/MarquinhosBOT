import { GameManager } from '@marquinhos/game/core/GameManager';
import { GameState } from '@marquinhos/game/core/GameTypes';
import { BotEvent } from '@marquinhos/types';
import BotError from '@marquinhos/utils/botError';
import { logger } from '@marquinhos/utils/logger';
import { XPSystem } from '@marquinhos/utils/xpSystem';
import { useMainPlayer } from 'discord-player';
import {
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  Guild,
} from 'discord.js';

const gameManager = GameManager.getInstance();

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

        // Level-up and achievement notifications come directly from the addXP
        // API response — no separate polling call needed.
        await XPSystem.addCommandXP(interaction);
      });
    } else if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      const session = gameManager.getSessionByChannel(btn.channelId);
      if (!session) return;

      const gameInstance = gameManager.getGameInstance(session.id);
      if (!gameInstance) return;

      try {
        await gameInstance.handlePlayerAction(btn.user.id, btn);

        const updatedSession = gameManager.getSession(session.id);
        if (!updatedSession || updatedSession.state === GameState.FINISHED) {
          const result = await gameInstance.finish();
          await gameManager.endSessionWithResult(session.id, result);
        }
      } catch (error) {
        console.error('Game button handler error:', error);
      }
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
