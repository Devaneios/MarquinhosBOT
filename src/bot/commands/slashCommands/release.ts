import { GuildMember, SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from '@marquinhos/types';
import GuildUserModel from '@marquinhos/database/schemas/guildUser';

export const release: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('desprender')
    .setDescription('Solto o teu preso preferido.')
    .addUserOption((option) =>
      option
        .setName('preso')
        .setDescription('A pessoa que você quer soltar.')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const arrested = interaction.options.get('preso')?.member as GuildMember;

    if (interaction.member === arrested) {
      interaction.reply({
        content: `Cara, e desde quando os presos têm a chave da cela?`,
      });
      return;
    }

    const releaseResult = await findAndReleaseMember(arrested);

    if (releaseResult) {
      return await interaction.reply({
        content: `Abrindo a cela do ${arrested}.`,
      });
    } else if (releaseResult === null) {
      return await interaction.reply({
        content: `O ${arrested} nunca foi preso.`,
      });
    }

    interaction.reply({
      content: `Não acho que o ${arrested} tava preso não.`,
    });
  },
  cooldown: 10,
};

async function findAndReleaseMember(member: GuildMember) {
  const guildUser = await GuildUserModel.findOne({
    guildId: member.guild.id,
    userId: member.id,
  });

  if (!guildUser) {
    return null;
  }

  if (!guildUser.arrested) {
    return false;
  }

  guildUser.arrested = false;
  await guildUser.save();

  return true;
}
