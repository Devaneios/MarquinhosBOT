import { EmbedBuilder, GuildMember, SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from '@marquinhos/types';
import GuildUserModel from '@marquinhos/database/schemas/guildUser';

export const arrested: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('encarcerados')
    .setDescription('Te dou uma lista de quem tá preso'),
  execute: async (interaction) => {
    const arrested = await getArrested(
      (interaction.member as GuildMember).guild.id
    );
    const listOfArresteds: string = arrested
      .map((prisioner) => `:locked: <@${prisioner.userId}>`)
      .join('\n');

    const arrestedsEmbed = interaction.client
      .baseEmbed()
      .setTitle(':rotating_light: Lista dos criminosos :rotating_light:')
      .setTimestamp();

    if (listOfArresteds) {
      arrestedsEmbed.setDescription(`${listOfArresteds}`);
    } else {
      arrestedsEmbed.setDescription('**Ninguém está preso!**');
    }
    return await interaction.reply({
      embeds: [arrestedsEmbed],
    });
  },
  cooldown: 10,
};

async function getArrested(guildId: string) {
  return await GuildUserModel.find({ guildId, arrested: true });
}
