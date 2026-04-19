import { env } from '@marquinhos/config/environment';
import { registerSapphireCommands } from '@marquinhos/lib/registerSapphirePieces';
import { logger } from '@marquinhos/utils/logger';
import {
  ApplicationCommandRegistries,
  RegisterBehavior,
  SapphireClient,
  Events as SapphireEvents,
} from '@sapphire/framework';
import '@sapphire/plugin-logger/register';
import { GatewayIntentBits } from 'discord.js';

export async function registerCommands() {
  ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
    RegisterBehavior.Overwrite,
  );

  const client = new SapphireClient({
    intents: [GatewayIntentBits.Guilds],
    baseUserDirectory: null,
    loadMessageCommandListeners: false,
    loadDefaultErrorListeners: false,
  });

  registerSapphireCommands();

  try {
    logger.info('Started refreshing application commands.');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out while registering application commands.'));
      }, 30_000);

      client.once(SapphireEvents.ApplicationCommandRegistriesRegistered, () => {
        clearTimeout(timeout);
        resolve();
      });

      client.once(
        SapphireEvents.ApplicationCommandRegistriesBulkOverwriteError,
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      );

      client.login(env.MARQUINHOS_TOKEN).catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    logger.info('Successfully reloaded application commands.');
  } catch (error) {
    logger.error(error);
    throw error;
  } finally {
    client.destroy();
  }
}

if (import.meta.main) {
  try {
    await registerCommands();
    process.exit(0);
  } catch (error) {
    logger.error('Error registering slash commands:');
    logger.error(error);
    process.exit(1);
  }
}
