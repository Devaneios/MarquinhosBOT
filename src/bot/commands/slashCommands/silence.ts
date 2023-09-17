import { GuildMember, SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from 'src/types';
import SilencedModel from 'src/database/schemas/silenced';

export const silence: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('silenciar')
    .setDescription('SILÊNCIO')
    .addUserOption((option) =>
      option
        .setName('silenciado')
        .setDescription('A pessoa que você quer que eu silencie.')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const silenced = interaction.options.get('silenciado')
      .member as GuildMember;
    if (silenced.user.id === process.env.BOT_ID) {
      silenceMember(interaction.member as GuildMember);
      interaction.reply({ content: 'Po, vei, seja inteligente' });
      return;
    }

    if (silenced.user.bot) {
      interaction.reply({ content: 'Não pode fazer isso com  meus os bots.' });
      return;
    }

    silenceMember(silenced);
    interaction.reply({ content: `${silenced} SILÊNCIO!` });
  },
  cooldown: 10,
};

// TODO => Segregate model by guildId
function silenceMember(member: GuildMember) {
  const newSilenced = new SilencedModel({
    id: member.id,
    user: member.user.username,
  });
  newSilenced.save();
}
