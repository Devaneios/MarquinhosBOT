import { SlashCommand } from '@marquinhos/types';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  TextChannel,
  MessageFlags,
} from 'discord.js';

const api = new MarquinhosApiService();

export const admin: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Comandos administrativos')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((group) =>
      group
        .setName('termo')
        .setDescription('Gerenciar o jogo Termo')
        .addSubcommand((sub) =>
          sub
            .setName('novo')
            .setDescription('Força uma nova palavra para o Termo (uso em testes)'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('canal')
            .setDescription('Define o canal onde o Termo envia mensagens públicas')
            .addChannelOption((opt) =>
              opt
                .setName('canal')
                .setDescription('Canal de texto para o Termo')
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('status')
            .setDescription('Exibe as estatísticas de hoje (revela a palavra)'),
        ),
    ),

  execute: async (interaction) => {
    const subgroup = interaction.options.getSubcommandGroup(true);
    const sub = interaction.options.getSubcommand(true);

    if (subgroup === 'termo') {
      if (sub === 'canal') {
        const channel = interaction.options.getChannel('canal', true);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
          await api.setWordleConfig(interaction.guildId!, channel.id);
          await interaction.editReply({
            content: `✅ Canal do Termo configurado para <#${channel.id}>`,
          });
        } catch {
          await interaction.editReply({
            content: '❌ Erro ao salvar configuração.',
          });
        }
        return;
      }

      if (sub === 'novo') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let result: any;
        try {
          const response = await api.forceNewWordleWord(interaction.guildId!);
          result = response.data;
        } catch {
          await interaction.editReply({ content: '❌ Erro ao gerar nova palavra.' });
          return;
        }

        const embed = interaction.client.baseEmbed();
        embed
          .setTitle('🔄 Nova palavra do Termo gerada!')
          .setDescription(
            `**Palavra:** \`${result.word.toUpperCase()}\` (${result.wordLength} letras)\n` +
            `**Data:** ${result.wordDate}`,
          )
          .addFields(
            {
              name: 'Estatísticas anteriores',
              value:
                `👥 Jogadores: ${result.stats?.playersCount ?? 0}\n` +
                `✅ Acertos: ${result.stats?.winnersCount ?? 0}\n` +
                `📊 Média de tentativas: ${result.stats?.avgAttempts ?? 0}`,
            },
          );

        await interaction.editReply({ embeds: [embed] });

        // Also post in the configured wordle channel
        try {
          const configResponse = await api.getWordleConfig(interaction.guildId!);
          const channelId = (configResponse.data as any)?.channelId;
          if (!channelId) return;

          const wordleChannel = interaction.client.channels.cache.get(channelId) as
            | TextChannel
            | undefined;
          if (!wordleChannel) return;

          await wordleChannel.send(
            `🔄 **Nova palavra do Termo!** (${result.wordLength} letras) — boa sorte a todos!\n` +
            `${'⬜'.repeat(result.wordLength)}`,
          );
        } catch {
          // Silently ignore
        }
        return;
      }

      if (sub === 'status') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
          const response = await api.getWordleStats(interaction.guildId!);
          const stats = response.data as any;

          const embed = interaction.client.baseEmbed();
          embed
            .setTitle('📊 Termo — Estatísticas de Hoje')
            .addFields(
              { name: 'Data', value: stats.wordDate, inline: true },
              { name: 'Tamanho', value: `${stats.wordLength} letras`, inline: true },
              { name: 'Jogadores', value: String(stats.playersCount), inline: true },
              { name: 'Acertos', value: String(stats.winnersCount), inline: true },
              {
                name: 'Média de tentativas',
                value: String(stats.avgAttempts),
                inline: true,
              },
            );

          await interaction.editReply({ embeds: [embed] });
        } catch {
          await interaction.editReply({ content: '❌ Erro ao buscar estatísticas.' });
        }
        return;
      }
    }
  },
  cooldown: 5,
};
