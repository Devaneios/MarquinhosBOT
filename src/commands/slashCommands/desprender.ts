import { GuildMember, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../types';
import ArrestedModel from '../../schemas/arrested';

export const desprender: SlashCommand = {
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
    // Gets the member chosen to arrest
    const arrested = interaction.options.get('preso').member as GuildMember;

    // User cannot releat themselves
    if(interaction.member === arrested) {
        interaction.reply( {content: `Cara, e desde quando os presos têm a chave da cela?`});
        return;
    }

    // Search for the member in the BD
    const result = await findAndReleaseMember(arrested.id, arrested.user.tag);
    
    if(result.value) {
        interaction.reply( {content: `Abrindo a cela do ${arrested}.`});
        return;
    } 

    interaction.reply( {content: `Não acho que o ${arrested.nickname} tava preso não.`});
    
  },
  cooldown: 10,
};

function findAndReleaseMember( id: string, tag: string ) {
    // Deletes user from DB. If not found, return object with value property null
    return ArrestedModel.collection.findOneAndDelete({ id, tag });
}
