import { REST } from '@discordjs/rest';
import * as commands from '@marquinhos/bot/commands';
import { SlashCommand } from '@marquinhos/types';
import { logger } from '@marquinhos/utils/logger';
import { Routes } from 'discord-api-types/v10';
import { config } from 'dotenv';

config();

async function registerCommands() {
  const slashCommands = Object.values(commands)
    .filter((slashCommand) => !slashCommand.disabled)
    .map((slashCommand: SlashCommand) => {
      slashCommand.command.setName(
        `${slashCommand.command.name}${
          process.env.NODE_ENV === 'production' ? '' : '-dev'
        }`
      );
      return slashCommand.command;
    });

  console.log(slashCommands.length);

  const rest = new REST({ version: '10' }).setToken(
    process.env.MARQUINHOS_TOKEN as string
  );

  try {
    logger.info('Started refreshing application commands.');

    const data = await rest.put(
      Routes.applicationCommands(process.env.MARQUINHOS_CLIENT_ID as string),
      { body: slashCommands.map((command) => command.toJSON()) }
    );

    logger.info(
      `Successfully reloaded ${
        Array.isArray(data) ? data.length : 0
      } application commands.`
    );
  } catch (error) {
    logger.error(error);
  }
}

registerCommands().catch(console.error);
