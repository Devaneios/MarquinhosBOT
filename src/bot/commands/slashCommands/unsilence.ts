import { GuildMember, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';
import SilencedModel from '@schemas/silenced';

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
      .member as GuildMember;

    // Users cannot unsilence themselves
    if (interaction.member === unsilenced) {
      interaction.reply({ content: `Aí não, né` });
      return;
    }

    // Search for the member in the BD
    const result = await findAndUnsilenceMember(
      unsilenced.id,
      unsilenced.user.username
    );

    if (result.value) {
      interaction.reply({ content: `${unsilenced} pode falar novamente.` });
      return;
    }

    interaction.reply({
      content: `${unsilenced.nickname} já tava podendo falar..`,
    });
  },
  cooldown: 10,
};

function findAndUnsilenceMember(id: string, user: string) {
  // Deletes user from DB. If not found, return object with value property null
  return SilencedModel.collection.findOneAndDelete({ id, user });
}
