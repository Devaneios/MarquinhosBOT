import { SlashCommandBuilder } from '@discordjs/builders';
import { SpreadsheetService } from '@marquinhos/services/spreadsheet';
import { AvatarConfig, SlashCommand } from '@marquinhos/types';
import { logger } from '@marquinhos/utils/logger';
import { ChatInputCommandInteraction } from 'discord.js';

export const avatar: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Gerencia o avatar do bot')
    .setDefaultMemberPermissions(0)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('listar')
        .setDescription('Lista todos os avatares disponíveis')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('selecionar')
        .setDescription('Seleciona um avatar específico')
        .addStringOption((option) =>
          option
            .setName('nome')
            .setDescription('O nome do avatar')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('feriado')
        .setDescription('Atualiza para o avatar de feriado atual')
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();

    try {
      const spreadsheet = SpreadsheetService.getInstance();
      const avatars = await spreadsheet.getRowsAsObjects<AvatarConfig>(
        'avatars',
        'A1:D'
      );

      switch (subcommand) {
        case 'listar':
          await handleListAvatars(interaction, avatars);
          break;
        case 'selecionar':
          await handleSelectAvatar(interaction, avatars);
          break;
        case 'feriado':
          await handleHolidayAvatar(interaction, avatars);
          break;
      }
    } catch (error) {
      logger.error('Error in avatar command:', error);
      await interaction.reply({
        content: 'Houve um erro ao processar o comando de avatar.',
        ephemeral: true,
      });
    }
  },
  autocomplete: async (interaction: any) => {
    const focusedValue = interaction.options.getFocused();
    const spreadsheet = SpreadsheetService.getInstance();
    const avatars = await spreadsheet.getRowsAsObjects<AvatarConfig>(
      'avatars',
      'A1:D'
    );

    const filtered = avatars
      .filter((avatar) =>
        avatar.name.toLowerCase().includes(focusedValue.toLowerCase())
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map((avatar) => ({
        name: avatar.name,
        value: avatar.name,
      }))
    );
  },
};

async function handleListAvatars(
  interaction: ChatInputCommandInteraction,
  avatars: AvatarConfig[]
) {
  await interaction.deferReply({ ephemeral: true });

  if (!avatars || avatars.length === 0) {
    return interaction.editReply('Nenhum avatar encontrado.');
  }

  const avatarList = avatars
    .map((avatar) => {
      if (!avatar.startDate || !avatar.endDate) {
        return `- **${avatar.name}** (Sem período definido)`;
      }

      const currentDate = new Date();
      const startDate = new Date(avatar.startDate);
      startDate.setFullYear(
        currentDate.getFullYear() + startDate.getFullYear() - 2017
      );
      const endDate = new Date(avatar.endDate);
      endDate.setFullYear(
        currentDate.getFullYear() + endDate.getFullYear() - 2017
      );

      return `- **${avatar.name}**  (<t:${Math.floor(
        startDate.getTime() / 1000
      )}:D> até <t:${Math.floor(endDate.getTime() / 1000)}:D>)`;
    })
    .join('\n');

  await interaction.editReply(`## Avatares disponíveis:\n${avatarList}`);
}

async function handleSelectAvatar(
  interaction: ChatInputCommandInteraction,
  avatars: AvatarConfig[]
) {
  await interaction.deferReply();

  const avatarName = interaction.options.getString('nome');

  const selectedAvatar = avatars.find((avatar) => avatar.name === avatarName);

  if (!selectedAvatar || !selectedAvatar.url) {
    return interaction.editReply(`Avatar "${avatarName}" não encontrado.`);
  }

  try {
    await interaction.client.user?.setAvatar(selectedAvatar.url);
    await interaction.editReply(
      `Avatar alterado para "${selectedAvatar.name}".`
    );
    logger.info(
      `Avatar changed to ${selectedAvatar.name} by ${interaction.user.tag}`
    );
  } catch (error) {
    logger.error('Error setting avatar:', error);
    await interaction.editReply(
      'Não foi possível alterar o avatar. Tente novamente mais tarde.'
    );
  }
}

async function handleHolidayAvatar(
  interaction: ChatInputCommandInteraction,
  avatars: AvatarConfig[]
) {
  await interaction.deferReply();

  try {
    const avatar = await findSeasonalAvatar(avatars);
    logger.info(`Updating avatar to ${avatar.name}`);
    await interaction.client.user?.setAvatar(avatar.url);
    await interaction.editReply(
      `Avatar atualizado para o tema "${avatar.name}".`
    );
  } catch (error) {
    logger.error('Error setting holiday avatar:', error);
    await interaction.editReply(
      'Não foi possível atualizar o avatar. Tente novamente mais tarde.'
    );
  }
}

async function findSeasonalAvatar(
  avatars: AvatarConfig[]
): Promise<AvatarConfig> {
  const currentDate = new Date();

  const currentSeasonAvatar = avatars.find((avatar) => {
    if (!avatar.startDate || !avatar.endDate) return false;

    const startDate = new Date(avatar.startDate);
    startDate.setFullYear(
      currentDate.getFullYear() + startDate.getFullYear() - 2017
    );
    const endDate = new Date(avatar.endDate);
    endDate.setFullYear(
      currentDate.getFullYear() + endDate.getFullYear() - 2017
    );

    console.log(startDate, endDate, currentDate);

    return currentDate >= startDate && currentDate <= endDate;
  });

  console.log('Current season avatar:', currentSeasonAvatar);

  if (currentSeasonAvatar) return currentSeasonAvatar;

  const defaultAvatar = avatars.find((avatar) => avatar.name === 'Padrão');

  if (defaultAvatar && process.env.NODE_ENV === 'production')
    return defaultAvatar;

  const devAvatar = avatars.find((avatar) => avatar.name === 'Dev');

  return (
    devAvatar ?? {
      name: 'Padrão',
      url: 'https://res.cloudinary.com/dzwcfzqvm/image/upload/v1748117320/marquinhoshead_an6cmr.jpg',
      startDate: null,
      endDate: null,
    }
  );
}
