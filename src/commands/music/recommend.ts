import { env } from '@marquinhos/config/environment';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { HttpClient } from '@marquinhos/utils/httpClient';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';

interface RecommendationItem {
  artist: string;
  title: string;
  reason?: string;
}

interface RecommendationResponse {
  data: RecommendationItem[];
}

const httpClient = new HttpClient({
  baseURL: env.MARQUINHOS_API_URL,
  headers: { Authorization: `Bearer ${env.MARQUINHOS_API_KEY}` },
  retries: 2,
});

export class RecommendCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'recommend', cooldownDelay: 30_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Recebe recomendações de música personalizadas')
        .addSubcommand((sub) =>
          sub
            .setName('personalized')
            .setDescription('Recomendações baseadas no seu gosto musical')
            .addIntegerOption((opt) =>
              opt
                .setName('quantidade')
                .setDescription('Número de recomendações (1-10)')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('genre')
            .setDescription('Recomendações de um gênero específico')
            .addStringOption((opt) =>
              opt
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
        .addSubcommand((sub) =>
          sub
            .setName('time')
            .setDescription('Recomendações baseadas no horário')
            .addStringOption((opt) =>
              opt
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
        .addSubcommand((sub) =>
          sub
            .setName('collaborative')
            .setDescription('Recomendações baseadas em usuários similares'),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
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
          recommendations = await getRecommendations(
            `/api/recommendations/personalized/${userId}/${guildId}?limit=${limit}`,
          );
          title = '🎵 Recomendações Personalizadas';
          description = 'Baseadas no seu histórico musical';
          break;
        }
        case 'genre': {
          const genre = interaction.options.getString('genero')!;
          recommendations = await getRecommendations(
            `/api/recommendations/genre/${genre}/${guildId}`,
          );
          title = `🎵 Recomendações de ${getGenreLabel(genre)}`;
          description = `Músicas populares do gênero ${getGenreLabel(genre)}`;
          break;
        }
        case 'time': {
          const timeOfDay = interaction.options.getString('periodo')!;
          recommendations = await getRecommendations(
            `/api/recommendations/time/${userId}/${guildId}/${timeOfDay}`,
          );
          title = `🎵 Recomendações para ${getTimeLabel(timeOfDay)}`;
          description = `Músicas perfeitas para ${getTimeLabel(timeOfDay)}`;
          break;
        }
        case 'collaborative':
          recommendations = await getRecommendations(
            `/api/recommendations/collaborative/${userId}/${guildId}`,
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

      const embed = baseEmbed(this.container.client)
        .setTitle(title)
        .setDescription(description);
      const recommendationText = recommendations
        .map(
          (rec, index) =>
            `**${index + 1}.** ${rec.artist || 'Artista Desconhecido'} - ${rec.title}\n*${rec.reason || 'Recomendado para você'}*`,
        )
        .join('\n\n');
      embed.addFields({
        name: 'Sugestões',
        value: recommendationText,
        inline: false,
      });
      if (recommendations.length > 0)
        embed.setFooter({
          text: `${recommendations.length} recomendações encontradas`,
        });
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in recommend command:', error);
      await interaction.editReply(
        'Ocorreu um erro ao buscar recomendações. Tente novamente mais tarde.',
      );
    }
  }
}

async function getRecommendations(path: string): Promise<RecommendationItem[]> {
  try {
    const data = (await httpClient.get(path)) as RecommendationResponse;
    return data.data || [];
  } catch (error) {
    logger.warn('Failed to get recommendations:', error);
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
