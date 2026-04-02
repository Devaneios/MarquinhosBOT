import { SlashCommand } from '@marquinhos/types';
import { HttpClient } from '@marquinhos/utils/httpClient';
import { logger } from '@marquinhos/utils/logger';
import { SlashCommandBuilder } from 'discord.js';

interface RecommendationItem {
  artist: string;
  title: string;
  reason?: string;
}

interface RecommendationResponse {
  data: RecommendationItem[];
}

const httpClient = new HttpClient({
  baseURL: process.env.MARQUINHOS_API_URL,
  headers: {
    Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
  },
  retries: 2,
});

export const recommend: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('recommend')
    .setDescription('Recebe recomendações de música personalizadas')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('personalized')
        .setDescription('Recomendações baseadas no seu gosto musical')
        .addIntegerOption((option) =>
          option
            .setName('quantidade')
            .setDescription('Número de recomendações (1-10)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('genre')
        .setDescription('Recomendações de um gênero específico')
        .addStringOption((option) =>
          option
            .setName('genero')
            .setDescription('Gênero musical')
            .setRequired(true)
            .addChoices(
              { name: 'Rock', value: 'rock' },
              { name: 'Pop', value: 'pop' },
              { name: 'Jazz', value: 'jazz' },
              { name: 'Eletrônica', value: 'electronic' },
              { name: 'Hip-Hop', value: 'hip-hop' },
              { name: 'Clássica', value: 'classical' },
              { name: 'Country', value: 'country' },
              { name: 'Indie', value: 'indie' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('time')
        .setDescription('Recomendações baseadas no horário')
        .addStringOption((option) =>
          option
            .setName('periodo')
            .setDescription('Período do dia')
            .setRequired(true)
            .addChoices(
              { name: 'Manhã', value: 'morning' },
              { name: 'Tarde', value: 'afternoon' },
              { name: 'Noite', value: 'evening' },
              { name: 'Madrugada', value: 'night' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('collaborative')
        .setDescription('Recomendações baseadas em usuários similares'),
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
      let recommendations: RecommendationItem[] = [];
      let title = '';
      let description = '';

      switch (subcommand) {
        case 'personalized': {
          const limit = interaction.options.getInteger('quantidade') || 5;
          recommendations = await getPersonalizedRecommendations(
            userId,
            guildId,
            limit,
          );
          title = '🎵 Recomendações Personalizadas';
          description = 'Baseadas no seu histórico musical';
          break;
        }

        case 'genre': {
          const genre = interaction.options.getString('genero')!;
          recommendations = await getGenreRecommendations(genre, guildId);
          title = `🎵 Recomendações de ${getGenreLabel(genre)}`;
          description = `Músicas populares do gênero ${getGenreLabel(genre)}`;
          break;
        }

        case 'time': {
          const timeOfDay = interaction.options.getString('periodo')!;
          recommendations = await getTimeRecommendations(
            userId,
            guildId,
            timeOfDay,
          );
          title = `🎵 Recomendações para ${getTimeLabel(timeOfDay)}`;
          description = `Músicas perfeitas para ${getTimeLabel(timeOfDay)}`;
          break;
        }

        case 'collaborative':
          recommendations = await getCollaborativeRecommendations(
            userId,
            guildId,
          );
          title = '🎵 Descobertas Colaborativas';
          description = 'Baseadas em usuários com gosto similar';
          break;
      }

      if (recommendations.length === 0) {
        await interaction.editReply(
          'Nenhuma recomendação encontrada. Use mais comandos de música para melhorar as sugestões!',
        );
        return;
      }

      const embed = interaction.client
        .baseEmbed()
        .setTitle(title)
        .setDescription(description);

      const recommendationText = recommendations
        .map(
          (rec, index) =>
            `**${index + 1}.** ${rec.artist || 'Artista Desconhecido'} - ${rec.title}\n` +
            `*${rec.reason || 'Recomendado para você'}*`,
        )
        .join('\n\n');

      embed.addFields({
        name: 'Sugestões',
        value: recommendationText,
        inline: false,
      });

      if (recommendations.length > 0) {
        embed.setFooter({
          text: `${recommendations.length} recomendações encontradas`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in recommend command:', error);
      await interaction.editReply(
        'Ocorreu um erro ao buscar recomendações. Tente novamente mais tarde.',
      );
    }
  },
  cooldown: 30,
};

async function getPersonalizedRecommendations(
  userId: string,
  guildId: string,
  limit: number,
): Promise<RecommendationItem[]> {
  try {
    const data = (await httpClient.get(
      `/api/recommendations/personalized/${userId}/${guildId}?limit=${limit}`,
    )) as RecommendationResponse;
    return data.data || [];
  } catch (error) {
    logger.warn('Failed to get personalized recommendations:', error);
    return [];
  }
}

async function getGenreRecommendations(
  genre: string,
  guildId: string,
): Promise<RecommendationItem[]> {
  try {
    const data = (await httpClient.get(
      `/api/recommendations/genre/${genre}/${guildId}`,
    )) as RecommendationResponse;
    return data.data || [];
  } catch (error) {
    logger.warn('Failed to get genre recommendations:', error);
    return [];
  }
}

async function getTimeRecommendations(
  userId: string,
  guildId: string,
  timeOfDay: string,
): Promise<RecommendationItem[]> {
  try {
    const data = (await httpClient.get(
      `/api/recommendations/time/${userId}/${guildId}/${timeOfDay}`,
    )) as RecommendationResponse;
    return data.data || [];
  } catch (error) {
    logger.warn('Failed to get time recommendations:', error);
    return [];
  }
}

async function getCollaborativeRecommendations(
  userId: string,
  guildId: string,
): Promise<RecommendationItem[]> {
  try {
    const data = (await httpClient.get(
      `/api/recommendations/collaborative/${userId}/${guildId}`,
    )) as RecommendationResponse;
    return data.data || [];
  } catch (error) {
    logger.warn('Failed to get collaborative recommendations:', error);
    return [];
  }
}

function getGenreLabel(genre: string): string {
  const labels: Record<string, string> = {
    rock: 'Rock',
    pop: 'Pop',
    jazz: 'Jazz',
    electronic: 'Eletrônica',
    'hip-hop': 'Hip-Hop',
    classical: 'Clássica',
    country: 'Country',
    indie: 'Indie',
  };
  return labels[genre] || genre;
}

function getTimeLabel(timeOfDay: string): string {
  const labels: Record<string, string> = {
    morning: 'manhã',
    afternoon: 'tarde',
    evening: 'noite',
    night: 'madrugada',
  };
  return labels[timeOfDay] || timeOfDay;
}
