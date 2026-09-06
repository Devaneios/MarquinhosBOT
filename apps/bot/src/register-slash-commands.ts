import { env } from '@marquinhos/config/environment';
import { registerSapphireCommands } from '@marquinhos/lib/registerSapphirePieces';
import { logger } from '@marquinhos/utils/logger';
import {
  ApplicationCommandRegistries,
  container,
  RegisterBehavior,
  SapphireClient,
  Events as SapphireEvents,
} from '@sapphire/framework';
import '@sapphire/plugin-logger/register';
import { GatewayIntentBits } from 'discord.js';

const LOGIN_TIMEOUT_MS = 60_000;
const REGISTRATION_TIMEOUT_MS = 120_000;
const BULK_OVERWRITE_RETRIES = 3;

type Phase = 'login' | 'registration';

const PHASE_HINTS: Record<Phase, string> = {
  login:
    'the client never became ready — check MARQUINHOS_TOKEN, network access and the Discord gateway status',
  registration:
    'Discord never answered the application command overwrite — check for rate limits or invalid command data',
};

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  phase: Phase,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out after ${ms / 1000}s during the ${phase} phase: ${PHASE_HINTS[phase]}`,
        ),
      );
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function collectUnregisteredCommands(): string[] {
  const unregistered: string[] = [];
  for (const command of container.stores.get('commands').values()) {
    const registry = command.applicationCommandRegistry;
    if (
      registry.globalCommandId === null &&
      registry.guildCommandIds.size === 0
    ) {
      unregistered.push(command.name);
    }
  }
  return unregistered.sort();
}

export async function registerCommands() {
  ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
    RegisterBehavior.BulkOverwrite,
  );
  ApplicationCommandRegistries.setBulkOverwriteRetries(BULK_OVERWRITE_RETRIES);

  const client = new SapphireClient({
    intents: [GatewayIntentBits.Guilds],
    baseUserDirectory: null,
    loadMessageCommandListeners: false,
    loadDefaultErrorListeners: false,
  });

  registerSapphireCommands();

  const failures: string[] = [];
  const publishedNames = new Set<string>();

  client.on(
    SapphireEvents.CommandApplicationCommandRegistryError,
    (error, command) => {
      failures.push(`command "${command.name}"`);
      logger.error(
        `Failed to build application command data for "${command.name}" (${command.location.full})`,
      );
      logger.error(formatError(error));
    },
  );

  client.on(
    SapphireEvents.ApplicationCommandRegistriesBulkOverwriteError,
    (error, guildId) => {
      const scope = guildId ? `guild ${guildId}` : 'global';
      failures.push(`${scope} overwrite`);
      logger.error(`Failed to overwrite ${scope} application commands`);
      logger.error(formatError(error));
    },
  );

  client.on(
    SapphireEvents.ApplicationCommandRegistriesBulkOverwrite,
    (result, guildId) => {
      const scope = guildId ? `guild ${guildId}` : 'global';
      const names = [...result.values()].map((command) => command.name).sort();
      for (const name of names) publishedNames.add(name);
      logger.info(
        `Discord accepted ${result.size} ${scope} command(s): ${names.join(', ')}`,
      );
    },
  );

  client.once(SapphireEvents.ApplicationCommandRegistriesInitialising, () => {
    logger.info('Building application command data...');
  });

  const readyPromise = new Promise<void>((resolve) => {
    client.once(SapphireEvents.ClientReady, () => resolve());
  });

  const registeredPromise = new Promise<number>((resolve) => {
    client.once(
      SapphireEvents.ApplicationCommandRegistriesRegistered,
      (_registries, timeTaken) => resolve(timeTaken),
    );
  });

  const loginFailure = new Promise<never>((_, reject) => {
    client.login(env.MARQUINHOS_TOKEN).catch((error) => {
      reject(new Error(`Discord login failed: ${formatError(error)}`));
    });
  });

  logger.info(
    'Using bulk overwrite — the global command list on Discord will be replaced by exactly the commands found in this codebase.',
  );
  logger.info('Connecting to Discord...');

  try {
    await withTimeout(
      Promise.race([readyPromise, loginFailure]),
      LOGIN_TIMEOUT_MS,
      'login',
    );
    logger.info(
      `Logged in as ${client.user?.tag ?? 'unknown user'} (${client.user?.id ?? 'unknown id'})`,
    );

    const loadedCommands = [...container.stores.get('commands').keys()].sort();
    logger.info(
      `Loaded ${loadedCommands.length} command piece(s): ${loadedCommands.join(', ')}`,
    );

    const timeTaken = await withTimeout(
      Promise.race([registeredPromise, loginFailure]),
      REGISTRATION_TIMEOUT_MS,
      'registration',
    );

    const unregistered = collectUnregisteredCommands();
    if (unregistered.length > 0) {
      failures.push(`never got an id from Discord: ${unregistered.join(', ')}`);
      logger.error(
        `${unregistered.length} command piece(s) were loaded but never got an id back from Discord: ${unregistered.join(', ')}`,
      );
    }

    if (failures.length > 0) {
      throw new Error(
        `Application command registration finished with ${failures.length} failure(s): ${failures.join('; ')}`,
      );
    }

    logger.info(
      `Successfully registered ${publishedNames.size} application command(s) in ${(timeTaken / 1000).toFixed(1)}s`,
    );
  } finally {
    await client.destroy();
  }
}

if (import.meta.main) {
  try {
    await registerCommands();
    process.exit(0);
  } catch (error) {
    logger.error('Error registering slash commands:');
    logger.error(formatError(error));
    process.exit(1);
  }
}
