import {
  GuildMember,
  PermissionsBitField,
  SlashCommandBuilder,
} from 'discord.js';

import { SlashCommand } from 'src/types';
import GuildModel from 'src/database/schemas/guild';

export const addToRoulette: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('adicionar-membro')
    .setDescription(
      'Pra adicionar um membro na roleta de admins. (Comando limitado)'
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Essa é a pessoa que vou adicionar pra a roleta.')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const newMember = interaction.options.get('usuario').member as GuildMember;
    addMemberToRoulette(interaction.guild.id, newMember.id);
    interaction.reply(
      `Agora adicionei ${newMember} na roleta de admins. Parabéns e tals.`
    );
  },
};

// TODO => Check if member already exists in collection's array
async function addMemberToRoulette(guildID: string, memberId: string) {
  GuildModel.collection.updateOne(
    {
      guildID,
    },
    // Update collection just with the new member
    { $push: { 'roulette.rouletteAdmins': memberId } }
  );
}
