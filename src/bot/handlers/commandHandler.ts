import { logger } from '@marquinhos/utils/logger';
import { useMainPlayer } from 'discord-player';
import { ChatInputCommandInteraction, Guild } from 'discord.js';

const TIMED_MESSAGE_DURATION_MS = 10_000;

export async function handleCommandInteraction(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const command = interaction.client.slashCommands.get(interaction.commandName);
  if (!command) return;

  // Use userId (not username) as the cooldown key — usernames are not unique
  const cooldownKey = `${interaction.commandName}-${interaction.user.id}`;
  const cooldown = interaction.client.cooldowns.get(cooldownKey);

  if (command.cooldown && cooldown) {
    if (Date.now() < cooldown) {
      await interaction.reply(
        `Vai com calma! Você pode usar esse comando novamente daqui ${Math.floor(
          Math.abs(Date.now() - cooldown) / 1000,
        )} segundos.`,
      );
      setTimeout(() => interaction.deleteReply(), TIMED_MESSAGE_DURATION_MS);
      return;
    }
    // Expired cooldown entry — reset it with a deletion timer
    interaction.client.cooldowns.set(
      cooldownKey,
      Date.now() + command.cooldown * 1000,
    );
    setTimeout(
      () => interaction.client.cooldowns.delete(cooldownKey),
      command.cooldown * 1000,
    );
  } else if (command.cooldown && !cooldown) {
    interaction.client.cooldowns.set(
      cooldownKey,
      Date.now() + command.cooldown * 1000,
    );
    setTimeout(
      () => interaction.client.cooldowns.delete(cooldownKey),
      command.cooldown * 1000,
    );
  }

  logger.info(
    `${interaction.user.username} executing command: ${interaction.commandName} ${
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
  const data = { guild: interaction.guild as Guild };

  // Bug fix: await provide() so errors in command.execute() propagate instead
  // of becoming silently dropped unhandled promise rejections.
  await player.context.provide(data, async () => {
    await command.execute(interaction);
  });
}
