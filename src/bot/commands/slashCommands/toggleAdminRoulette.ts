import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from 'src/types';
import GuildModel from 'src/database/schemas/guild';

export const toggleAdminRoulette: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('alternar-roleta-admin')
    .setDescription('Ligo ou desligo a roleta de admins')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addBooleanOption((option) =>
      option
        .setName('ligado')
        .setDescription('Se é pra ligar ou desligar. Dã.')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const isRouletteOn = await getAdminRouletteValue(interaction.guild.id);
    const optionValue = interaction.options.get('ligado').value as boolean;
    if (isRouletteOn === optionValue) {
      interaction.reply('Mas já tava assim... Eu não fiz nada de novo..');
      return;
    }

    setAdminRouletteValue(interaction.guild.id, optionValue);
    if (!optionValue) {
      interaction.reply('Roleta de admins desligada.');
      return;
    }

    // TODO => Start roulette here so it doesn't need to wait for on ready event
    interaction.reply('Beleza. Liguei a roleta de admins.');
  },
  cooldown: 10,
};

async function getAdminRouletteValue(guildID: string) {
  const guild = await GuildModel.collection.findOne({ guildID });
  return guild.roulette.isRouletteOn;
}

async function setAdminRouletteValue(guildID: string, value: boolean) {
  await GuildModel.updateOne(
    {
      guildID,
    },
    { $set: { ['roulette.isRouletteOn']: value } }
  );
}
