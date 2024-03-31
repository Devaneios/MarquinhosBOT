import { GuildMember, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';
import GuildUserModel from '@marquinhos/database/schemas/guildUser';

export const unsilence: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('liberar')
    .setDescription('Dou permissão pra alguém falar novamente')
    .addUserOption((option) =>
      option
        .setName('liberado')
        .setDescription('A pessoa que você quer deixar falar.')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    // Gets the member chosen to unsilence
    const unsilenced = interaction.options.get('liberado')
      ?.member as GuildMember;

    // Users cannot unsilence themselves
    if (interaction.member === unsilenced) {
      interaction.reply({ content: `Aí não, né` });
      return;
    }

    // Search for the member in the BD
    const unsilencedGuildUser = await findAndUnsilenceMember(unsilenced);

    if (unsilencedGuildUser === null) {
      interaction.reply({ content: `O ${unsilenced} nunca foi silenciado.` });
      return;
    }

    if (unsilencedGuildUser) {
      interaction.reply({ content: `${unsilenced} pode falar novamente.` });
      return;
    }

    interaction.reply({
      content: `${unsilenced.nickname} já tava podendo falar..`,
    });
  },
  cooldown: 10,
};

async function findAndUnsilenceMember(member: GuildMember) {
  const guildUser = await GuildUserModel.findOne({
    guildId: member.guild.id,
    userId: member.id,
  });

  if (!guildUser) {
    return null;
  }

  if (!guildUser.silenced) {
    return false;
  }

  guildUser.silenced = false;
  await guildUser.save();
  return true;
}
