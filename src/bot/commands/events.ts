import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';

export const events: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('events')
    .setDescription('Sistema de eventos musicais')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Cria um evento musical')
        .addStringOption(option =>
          option
            .setName('nome')
            .setDescription('Nome do evento')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('data')
            .setDescription('Data do evento (DD/MM/YYYY HH:MM)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lista eventos próximos')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rsvp')
        .setDescription('Confirma presença em um evento')
        .addStringOption(option =>
          option
            .setName('evento')
            .setDescription('ID do evento')
            .setRequired(true)
        )
    ) as SlashCommandBuilder,
  execute: async (interaction) => {
    await interaction.deferReply();
    
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'create':
        const eventName = interaction.options.getString('nome');
        const eventDate = interaction.options.getString('data');
        
        const embed = interaction.client.baseEmbed()
          .setTitle('🎉 Evento Criado!')
          .setDescription(`**${eventName}**\n📅 ${eventDate}`)
          .addFields(
            { name: 'Organizador', value: interaction.user.username, inline: true },
            { name: 'Participantes', value: '1', inline: true }
          );
        
        await interaction.editReply({ embeds: [embed] });
        break;
        
      case 'list':
        const listEmbed = interaction.client.baseEmbed()
          .setTitle('🎉 Próximos Eventos')
          .setDescription(
            '🎵 **Album Listening Party** - Hoje 20:00\n' +
            '🎤 **Karaokê Night** - Amanhã 19:00\n' +
            '🎸 **Rock Discovery** - 25/12 21:00'
          );
        
        await interaction.editReply({ embeds: [listEmbed] });
        break;
        
      case 'rsvp':
        await interaction.editReply('✅ Presença confirmada no evento!');
        break;
    }
  },
  cooldown: 10,
};
