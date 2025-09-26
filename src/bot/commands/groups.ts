import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';

export const groups: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('groups')
    .setDescription('Sistema de grupos musicais')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Cria um grupo musical')
        .addStringOption(option =>
          option
            .setName('nome')
            .setDescription('Nome do grupo')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('genero')
            .setDescription('Gênero musical')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Entra em um grupo')
        .addStringOption(option =>
          option
            .setName('grupo')
            .setDescription('ID do grupo')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lista grupos disponíveis')
    ) as SlashCommandBuilder,
  execute: async (interaction) => {
    await interaction.deferReply();
    
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'create':
        const name = interaction.options.getString('nome');
        const genre = interaction.options.getString('genero') || 'Geral';
        
        const embed = interaction.client.baseEmbed()
          .setTitle('👥 Grupo Criado!')
          .setDescription(`**${name}**\nGênero: ${genre}`)
          .addFields(
            { name: 'Criador', value: interaction.user.username, inline: true },
            { name: 'Membros', value: '1', inline: true }
          );
        
        await interaction.editReply({ embeds: [embed] });
        break;
        
      case 'join':
        await interaction.editReply('✅ Você entrou no grupo com sucesso!');
        break;
        
      case 'list':
        const listEmbed = interaction.client.baseEmbed()
          .setTitle('👥 Grupos Musicais')
          .setDescription(
            '🎸 **Rock Lovers** - 15 membros\n' +
            '🎹 **Jazz Club** - 8 membros\n' +
            '🎵 **Pop Stars** - 23 membros'
          );
        
        await interaction.editReply({ embeds: [listEmbed] });
        break;
    }
  },
  cooldown: 10,
};
