import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';

const marquinhosApi = new MarquinhosApiService();

export const therapy: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('therapy')
    .setDescription('Terapia musical personalizada baseada em IA')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('Inicia uma sessão de terapia musical')
        .addStringOption((option) =>
          option
            .setName('mood')
            .setDescription('Como você está se sentindo?')
            .setRequired(true)
            .addChoices(
              { name: '😔 Triste', value: 'sad' },
              { name: '😰 Ansioso', value: 'anxious' },
              { name: '😤 Estressado', value: 'stressed' },
              { name: '😴 Cansado', value: 'tired' },
              { name: '😊 Neutro', value: 'neutral' },
              { name: '😄 Feliz', value: 'happy' },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName('energy')
            .setDescription('Nível de energia (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10),
        )
        .addIntegerOption((option) =>
          option
            .setName('stress')
            .setDescription('Nível de estresse (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10),
        )
        .addIntegerOption((option) =>
          option
            .setName('focus')
            .setDescription('Nível de foco (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10),
        )
        .addStringOption((option) =>
          option
            .setName('context')
            .setDescription('O que você está fazendo?')
            .setRequired(true)
            .addChoices(
              { name: '💼 Trabalhando', value: 'work' },
              { name: '📚 Estudando', value: 'study' },
              { name: '🏃 Exercitando', value: 'exercise' },
              { name: '😌 Relaxando', value: 'relax' },
              { name: '😴 Tentando dormir', value: 'sleep' },
              { name: '🎮 Jogando', value: 'gaming' },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Descreva como você está se sentindo (opcional)')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('end')
        .setDescription('Finaliza a sessão de terapia atual')
        .addStringOption((option) =>
          option
            .setName('session-id')
            .setDescription('ID da sessão de terapia')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('final-mood')
            .setDescription('Como você está se sentindo agora?')
            .setRequired(true)
            .addChoices(
              { name: '😔 Triste', value: 'sad' },
              { name: '😰 Ansioso', value: 'anxious' },
              { name: '😤 Estressado', value: 'stressed' },
              { name: '😴 Cansado', value: 'tired' },
              { name: '😊 Neutro', value: 'neutral' },
              { name: '😄 Feliz', value: 'happy' },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName('satisfaction')
            .setDescription('Quão satisfeito você ficou com a sessão? (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('insights')
        .setDescription('Vê insights da sua jornada de terapia musical'),
    ),
  execute: async (interaction) => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Este comando só pode ser usado em um servidor.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'start':
          const mood = interaction.options.getString('mood', true);
          const energy = interaction.options.getInteger('energy', true);
          const stress = interaction.options.getInteger('stress', true);
          const focus = interaction.options.getInteger('focus', true);
          const context = interaction.options.getString('context', true);
          const description = interaction.options.getString('description');

          const sessionResponse = await marquinhosApi.post(
            '/music-therapist/session/start',
            {
              userId: interaction.user.id,
              guildId: interaction.guildId,
              mood,
              energy,
              stress,
              focus,
              context,
              description,
              goals: ['stress_reduction', 'mood_improvement'],
            },
          );

          const session = sessionResponse.data;

          const sessionEmbed = interaction.client
            .baseEmbed()
            .setTitle('🧘 Sessão de Terapia Musical Iniciada')
            .setDescription(
              'Sua sessão personalizada foi criada com base no seu estado atual',
            )
            .addFields(
              {
                name: '🆔 ID da Sessão',
                value: `\`${session.sessionId}\``,
                inline: true,
              },
              {
                name: '🎯 Foco Terapêutico',
                value: getTherapyFocus(mood, stress, energy),
                inline: true,
              },
              {
                name: '🎵 Recomendações',
                value: session.recommendations
                  .slice(0, 3)
                  .map(
                    (rec: any) =>
                      `• **${rec.title}** - ${rec.artist}\n  _${rec.therapeuticPurpose}_`,
                  )
                  .join('\n'),
                inline: false,
              },
              {
                name: '💡 Dica',
                value:
                  'Use `/therapy end` quando terminar para registrar os resultados!',
                inline: false,
              },
            )
            .setColor('#9B59B6');

          await interaction.editReply({ embeds: [sessionEmbed] });
          break;

        case 'end':
          const sessionId = interaction.options.getString('session-id', true);
          const finalMood = interaction.options.getString('final-mood', true);
          const satisfaction = interaction.options.getInteger(
            'satisfaction',
            true,
          );

          const endResponse = await marquinhosApi.put(
            `/music-therapist/session/${sessionId}/end`,
            {
              mood: finalMood,
              energy: Math.max(1, Math.min(10, energy + 2)), // Simulated improvement
              stress: Math.max(1, stress - 1), // Simulated stress reduction
              focus: Math.max(1, Math.min(10, focus + 1)), // Simulated focus improvement
              satisfaction,
              notes: 'Sessão concluída via Discord',
            },
          );

          if (!endResponse.data) {
            await interaction.editReply({
              content: 'Sessão não encontrada. Verifique o ID da sessão.',
            });
            return;
          }

          const endedSession = endResponse.data;
          const improvement = calculateImprovement(mood, finalMood);

          const endEmbed = interaction.client
            .baseEmbed()
            .setTitle('✅ Sessão de Terapia Finalizada')
            .setDescription('Obrigado por usar a terapia musical!')
            .addFields(
              { name: '📊 Progresso', value: improvement, inline: true },
              {
                name: '⭐ Sua Avaliação',
                value: `${satisfaction}/10`,
                inline: true,
              },
              {
                name: '🎵 Músicas Efetivas',
                value: endedSession.recommendations
                  .filter((r: any) => (r.effectiveness || 0) > 7)
                  .length.toString(),
                inline: true,
              },
              {
                name: '💡 Recomendação',
                value: getPostSessionAdvice(satisfaction, finalMood),
                inline: false,
              },
            )
            .setColor(
              satisfaction >= 7
                ? '#27AE60'
                : satisfaction >= 4
                  ? '#F39C12'
                  : '#E74C3C',
            );

          await interaction.editReply({ embeds: [endEmbed] });
          break;

        case 'insights':
          const insightsResponse = await marquinhosApi.get(
            `/music-therapist/insights/${interaction.user.id}/${interaction.guildId}`,
          );

          if (!insightsResponse.data) {
            await interaction.editReply({
              content:
                'Você ainda não tem insights suficientes. Complete algumas sessões de terapia primeiro!',
            });
            return;
          }

          const insights = insightsResponse.data;

          const insightsEmbed = interaction.client
            .baseEmbed()
            .setTitle(`📈 Insights de Terapia Musical`)
            .setDescription(`Sua jornada de bem-estar através da música`)
            .addFields(
              {
                name: '📊 Estatísticas',
                value: `Sessões: ${insights.totalSessions}\nCompletas: ${insights.completedSessions}\nMelhora Média: ${insights.averageImprovement.toFixed(1)}`,
                inline: true,
              },
              {
                name: '🏆 Abordagens Efetivas',
                value:
                  insights.mostEffectiveApproaches.join('\n') ||
                  'Ainda coletando dados',
                inline: true,
              },
              {
                name: '📋 Preocupações Comuns',
                value:
                  insights.commonConcerns.join('\n') || 'Nenhuma identificada',
                inline: true,
              },
              {
                name: '📈 Tendência',
                value: getTrendDescription(insights.progressTrend),
                inline: false,
              },
              {
                name: '💡 Recomendações Personalizadas',
                value:
                  insights.personalizedRecommendations.join('\n') ||
                  'Continue suas sessões!',
                inline: false,
              },
            )
            .setColor('#8E44AD');

          await interaction.editReply({ embeds: [insightsEmbed] });
          break;
      }
    } catch (error) {
      console.error('Error with therapy:', error);
      await interaction.editReply({
        content:
          'Erro ao processar terapia musical. Tente novamente mais tarde.',
      });
    }
  },
  cooldown: 10,
};

function getTherapyFocus(mood: string, stress: number, energy: number): string {
  if (stress > 7) return 'Redução de Estresse';
  if (energy < 3) return 'Aumento de Energia';
  if (mood === 'anxious') return 'Alívio da Ansiedade';
  if (mood === 'sad') return 'Elevação do Humor';
  return 'Bem-estar Geral';
}

function calculateImprovement(initialMood: string, finalMood: string): string {
  const moodValues = {
    sad: 1,
    anxious: 2,
    stressed: 3,
    tired: 4,
    neutral: 5,
    happy: 6,
  };
  const initial = moodValues[initialMood as keyof typeof moodValues] || 5;
  const final = moodValues[finalMood as keyof typeof moodValues] || 5;
  const improvement = final - initial;

  if (improvement > 0) return `📈 Melhora de ${improvement} pontos`;
  if (improvement < 0) return `📉 Declínio de ${Math.abs(improvement)} pontos`;
  return '➡️ Manteve-se estável';
}

function getPostSessionAdvice(satisfaction: number, finalMood: string): string {
  if (satisfaction >= 8)
    return 'Ótimo! Continue usando a terapia musical regularmente.';
  if (satisfaction >= 6)
    return 'Bom progresso! Tente sessões mais longas na próxima vez.';
  if (satisfaction >= 4)
    return 'Progresso moderado. Experimente gêneros diferentes.';
  return 'Vamos ajustar a abordagem. Tente descrever melhor seus sentimentos na próxima vez.';
}

function getTrendDescription(trend: string): string {
  switch (trend) {
    case 'improving':
      return '📈 Melhorando consistentemente';
    case 'declining':
      return '📉 Precisa de mais atenção';
    case 'stable':
      return '➡️ Progresso estável';
    default:
      return '📊 Dados insuficientes';
  }
}
