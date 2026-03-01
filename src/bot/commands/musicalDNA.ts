import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';

const marquinhosApi = new MarquinhosApiService();

export const musicalDNA: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('musical-dna')
    .setDescription('Gera e analisa seu DNA musical único')
    .addSubcommand(subcommand =>
      subcommand
        .setName('generate')
        .setDescription('Gera seu perfil de DNA musical'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('compatibility')
        .setDescription('Verifica compatibilidade musical com outro usuário')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Usuário para comparar compatibilidade')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('evolution')
        .setDescription('Mostra sua evolução musical ao longo do tempo')),
  execute: async (interaction) => {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Este comando só pode ser usado em um servidor.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'generate':
          const dnaResponse = await marquinhosApi.post('/musical-dna/generate', {
            userId: interaction.user.id,
            guildId: interaction.guildId
          });
          
          const dna = dnaResponse.data;
          const topInstruments = Array.from(dna.instrumentPreferences.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([instrument, preference]) => `${instrument}: ${Math.round(preference * 100)}%`)
            .join('\n');

          const embed = interaction.client.baseEmbed()
            .setTitle(`🧬 DNA Musical de ${interaction.user.username}`)
            .setDescription(`**Assinatura:** \`${dna.dnaSignature}\``)
            .addFields(
              { name: '🎵 BPM Preferido', value: `${dna.preferredBPM.min}-${dna.preferredBPM.max} (pico: ${dna.preferredBPM.peak})`, inline: true },
              { name: '🎶 Harmonias', value: `Maior: ${Math.round(dna.harmonicPreferences.majorKeys * 100)}%\nMenor: ${Math.round(dna.harmonicPreferences.minorKeys * 100)}%`, inline: true },
              { name: '🎸 Instrumentos Favoritos', value: topInstruments || 'Nenhum ainda', inline: false }
            )
            .setThumbnail(interaction.user.displayAvatarURL());

          await interaction.editReply({ embeds: [embed] });
          break;

        case 'compatibility':
          const targetUser = interaction.options.getUser('user', true);
          
          const compatibilityResponse = await marquinhosApi.post('/musical-dna/compatibility', {
            userA: interaction.user.id,
            userB: targetUser.id,
            guildId: interaction.guildId
          });
          
          const compatibility = compatibilityResponse.data.compatibility;
          
          const compatEmbed = interaction.client.baseEmbed()
            .setTitle('🤝 Compatibilidade Musical')
            .setDescription(`Compatibilidade entre ${interaction.user.username} e ${targetUser.username}`)
            .addFields(
              { name: '💖 Pontuação', value: `**${compatibility}%**`, inline: true },
              { name: '🎯 Nível', value: getCompatibilityLevel(compatibility), inline: true }
            )
            .setColor(compatibility > 70 ? '#00FF00' : compatibility > 40 ? '#FFFF00' : '#FF0000');

          await interaction.editReply({ embeds: [compatEmbed] });
          break;

        case 'evolution':
          const evolutionResponse = await marquinhosApi.get(`/musical-dna/evolution/${interaction.user.id}/${interaction.guildId}`);
          
          if (!evolutionResponse.data) {
            await interaction.editReply({ content: 'Você ainda não tem dados de evolução suficientes. Continue ouvindo música!' });
            return;
          }
          
          const evolution = evolutionResponse.data;
          
          const evolutionEmbed = interaction.client.baseEmbed()
            .setTitle(`📈 Evolução Musical de ${interaction.user.username}`)
            .setDescription(`Período: ${evolution.timespan.months} meses de dados`)
            .addFields(
              { name: '🎵 BPM', value: `${evolution.changes.bpmEvolution.initial} → ${evolution.changes.bpmEvolution.current}`, inline: true },
              { name: '📊 Tendência', value: evolution.trends.join('\n') || 'Estável', inline: false }
            );

          await interaction.editReply({ embeds: [evolutionEmbed] });
          break;
      }
    } catch (error) {
      console.error('Error with musical DNA:', error);
      await interaction.editReply({ content: 'Erro ao processar DNA musical. Tente novamente mais tarde.' });
    }
  },
  cooldown: 10,
};

function getCompatibilityLevel(compatibility: number): string {
  if (compatibility >= 90) return '🔥 Almas Gêmeas Musicais';
  if (compatibility >= 70) return '💕 Muito Compatíveis';
  if (compatibility >= 50) return '😊 Boa Conexão';
  if (compatibility >= 30) return '🤔 Alguma Sintonia';
  return '😅 Gostos Diferentes';
}
