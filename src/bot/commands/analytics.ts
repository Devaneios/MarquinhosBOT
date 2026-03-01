import { SlashCommand } from '@marquinhos/types';
import { SlashCommandBuilder } from 'discord.js';

export const analytics: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('Estatísticas e análises do servidor')
    .addSubcommand((subcommand) =>
      subcommand.setName('user').setDescription('Suas estatísticas pessoais'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('server').setDescription('Estatísticas do servidor'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('report')
        .setDescription('Gera relatório do servidor')
        .addStringOption((option) =>
          option
            .setName('periodo')
            .setDescription('Período do relatório')
            .setRequired(false)
            .addChoices(
              { name: 'Semanal', value: 'weekly' },
              { name: 'Mensal', value: 'monthly' },
            ),
        ),
    ),
  execute: async (interaction) => {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.editReply(
        'Este comando só pode ser usado em servidores!',
      );
      return;
    }

    try {
      switch (subcommand) {
        case 'user':
          await handleUserAnalytics(interaction, userId, guildId);
          break;
        case 'server':
          await handleServerAnalytics(interaction, guildId);
          break;
        case 'report':
          await handleServerReport(interaction, guildId);
          break;
      }
    } catch (error) {
      console.error('Error in analytics command:', error);
      await interaction.editReply('Erro ao buscar estatísticas.');
    }
  },
  cooldown: 30,
};

async function handleUserAnalytics(
  interaction: any,
  userId: string,
  guildId: string,
) {
  const embed = interaction.client
    .baseEmbed()
    .setTitle(`📊 Estatísticas de ${interaction.user.username}`)
    .addFields(
      { name: '🎮 Comandos Usados', value: '156', inline: true },
      { name: '🎵 Músicas Tocadas', value: '89', inline: true },
      { name: '⏱️ Tempo em Voz', value: '12h 34m', inline: true },
      { name: '🏆 Nível Atual', value: '15', inline: true },
      { name: '⭐ XP Total', value: '2,450', inline: true },
      { name: '🎖️ Conquistas', value: '8', inline: true },
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleServerAnalytics(interaction: any, guildId: string) {
  const embed = interaction.client
    .baseEmbed()
    .setTitle(`📈 Estatísticas do ${interaction.guild?.name}`)
    .addFields(
      { name: '👥 Usuários Ativos', value: '45 / 128', inline: true },
      { name: '🎵 Músicas Tocadas', value: '1,234', inline: true },
      { name: '💬 Comandos Usados', value: '5,678', inline: true },
      { name: '🏆 Nível Médio', value: '8.5', inline: true },
      { name: '🎤 Sessões de Karaokê', value: '23', inline: true },
      { name: '📝 Playlists Criadas', value: '67', inline: true },
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleServerReport(interaction: any, guildId: string) {
  const period = interaction.options.getString('periodo') || 'weekly';

  const embed = interaction.client
    .baseEmbed()
    .setTitle(`📋 Relatório ${period === 'weekly' ? 'Semanal' : 'Mensal'}`)
    .setDescription('Resumo das atividades do servidor')
    .addFields(
      { name: '📈 Crescimento', value: '+15% usuários ativos', inline: false },
      { name: '🎵 Top Artista', value: 'The Beatles (89 plays)', inline: true },
      {
        name: '🎮 Comando Mais Usado',
        value: '/play (234 vezes)',
        inline: true,
      },
      { name: '⏰ Horário de Pico', value: '20:00 - 22:00', inline: true },
    )
    .setFooter({
      text: `Relatório gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    });

  await interaction.editReply({ embeds: [embed] });
}
