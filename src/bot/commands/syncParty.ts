import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';

const marquinhosApi = new MarquinhosApiService();

export const syncParty: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('sync-party')
    .setDescription('Cria e gerencia festas de música sincronizada')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Cria uma nova festa sincronizada')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Nome da festa')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Descrição da festa')
            .setRequired(false),
        )
        .addBooleanOption((option) =>
          option
            .setName('voting')
            .setDescription('Permitir votação em músicas')
            .setRequired(false),
        )
        .addBooleanOption((option) =>
          option
            .setName('democratic')
            .setDescription('Controle democrático da playlist')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('join')
        .setDescription('Entra em uma festa sincronizada existente')
        .addStringOption((option) =>
          option
            .setName('party-id')
            .setDescription('ID da festa para entrar')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('platform')
            .setDescription('Plataforma de música que você está usando')
            .setRequired(true)
            .addChoices(
              { name: 'Spotify', value: 'spotify' },
              { name: 'YouTube Music', value: 'youtube' },
              { name: 'Apple Music', value: 'apple' },
              { name: 'Discord', value: 'discord' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add-track')
        .setDescription('Adiciona uma música à festa')
        .addStringOption((option) =>
          option
            .setName('party-id')
            .setDescription('ID da festa')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('song')
            .setDescription('Nome da música e artista')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('vote')
        .setDescription('Vota em uma música da playlist')
        .addStringOption((option) =>
          option
            .setName('party-id')
            .setDescription('ID da festa')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('track-number')
            .setDescription('Número da música na playlist')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('vote-type')
            .setDescription('Tipo de voto')
            .setRequired(true)
            .addChoices(
              { name: '👍 Curtir', value: 'up' },
              { name: '👎 Não curtir', value: 'down' },
              { name: '⏭️ Pular', value: 'next' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('Lista festas ativas no servidor'),
    ),
  execute: async (interaction) => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Este comando só pode ser usado em um servidor.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'create':
          const name = interaction.options.getString('name', true);
          const description =
            interaction.options.getString('description') || '';
          const allowVoting = interaction.options.getBoolean('voting') ?? true;
          const democraticControl =
            interaction.options.getBoolean('democratic') ?? false;

          const createResponse = await marquinhosApi.post(
            '/sync-party/create',
            {
              hostId: interaction.user.id,
              guildId: interaction.guildId,
              channelId: interaction.channelId,
              name,
              description,
              settings: {
                allowVoting,
                democraticControl,
                crossPlatformSync: true,
                latencyCompensation: true,
              },
            },
          );

          const party = createResponse.data as any;

          const createEmbed = interaction.client
            .baseEmbed()
            .setTitle('🎉 Festa Sincronizada Criada!')
            .setDescription(`**${name}**\n${description}`)
            .addFields(
              {
                name: '🆔 ID da Festa',
                value: `\`${party.id}\``,
                inline: true,
              },
              {
                name: '🎵 Configurações',
                value: `Votação: ${allowVoting ? '✅' : '❌'}\nControle Democrático: ${democraticControl ? '✅' : '❌'}`,
                inline: true,
              },
              {
                name: '📱 Como Participar',
                value: `Use \`/sync-party join party-id:${party.id}\``,
                inline: false,
              },
            );

          await interaction.editReply({ embeds: [createEmbed] });
          break;

        case 'join':
          const partyId = interaction.options.getString('party-id', true);
          const platform = interaction.options.getString('platform', true);

          const joinResponse = await marquinhosApi.post(
            `/sync-party/${partyId}/join`,
            {
              userId: interaction.user.id,
              platform,
            },
          );

          if (!joinResponse.data) {
            await interaction.editReply({
              content: 'Festa não encontrada ou inativa.',
            });
            return;
          }

          const joinedParty = joinResponse.data as any;

          const joinEmbed = interaction.client
            .baseEmbed()
            .setTitle('🎊 Entrou na Festa!')
            .setDescription(`Você entrou na festa **${joinedParty.name}**`)
            .addFields(
              {
                name: '👥 Participantes',
                value: `${joinedParty.participants.length}`,
                inline: true,
              },
              { name: '📱 Sua Plataforma', value: platform, inline: true },
              {
                name: '🎵 Música Atual',
                value: joinedParty.currentTrack?.title || 'Nenhuma tocando',
                inline: false,
              },
            );

          await interaction.editReply({ embeds: [joinEmbed] });
          break;

        case 'add-track':
          const addPartyId = interaction.options.getString('party-id', true);
          const songName = interaction.options.getString('song', true);

          // Parse song name (simplified)
          const [artist, title] = songName.includes(' - ')
            ? songName.split(' - ', 2)
            : ['Artista Desconhecido', songName];

          const addResponse = await marquinhosApi.post(
            `/sync-party/${addPartyId}/track`,
            {
              userId: interaction.user.id,
              track: {
                title: title.trim(),
                artist: artist.trim(),
                url: `https://example.com/track/${Date.now()}`,
              },
            },
          );

          if (!addResponse.data) {
            await interaction.editReply({
              content: 'Festa não encontrada ou você não é participante.',
            });
            return;
          }

          const addEmbed = interaction.client
            .baseEmbed()
            .setTitle('🎵 Música Adicionada!')
            .setDescription(
              `**${title}** por **${artist}** foi adicionada à playlist`,
            )
            .addFields({
              name: '📋 Posição na Playlist',
              value: `#${(addResponse.data as any).playlist.length}`,
              inline: true,
            });

          await interaction.editReply({ embeds: [addEmbed] });
          break;

        case 'vote':
          const votePartyId = interaction.options.getString('party-id', true);
          const trackNumber = interaction.options.getInteger(
            'track-number',
            true,
          );
          const voteType = interaction.options.getString('vote-type', true) as
            | 'up'
            | 'down'
            | 'next';

          const voteResponse = await marquinhosApi.post(
            `/sync-party/${votePartyId}/vote`,
            {
              userId: interaction.user.id,
              trackIndex: trackNumber - 1, // Convert to 0-based index
              voteType,
            },
          );

          if (!voteResponse.data) {
            await interaction.editReply({
              content: 'Festa não encontrada ou votação desabilitada.',
            });
            return;
          }

          const voteEmojis = { up: '👍', down: '👎', next: '⏭️' };
          const voteNames = {
            up: 'curtiu',
            down: 'não curtiu',
            next: 'quer pular',
          };

          const voteEmbed = interaction.client
            .baseEmbed()
            .setTitle(`${voteEmojis[voteType]} Voto Registrado!`)
            .setDescription(
              `Você ${voteNames[voteType]} a música #${trackNumber}`,
            );

          await interaction.editReply({ embeds: [voteEmbed] });
          break;

        case 'list':
          const listResponse = await marquinhosApi.get(
            `/sync-party/active/${interaction.guildId}`,
          );
          const activeParties = listResponse.data as any;

          if (!activeParties || activeParties.length === 0) {
            await interaction.editReply({
              content:
                'Nenhuma festa ativa no momento. Crie uma com `/sync-party create`!',
            });
            return;
          }

          const partiesText = activeParties
            .map(
              (p: any, index: number) =>
                `**${index + 1}.** ${p.name}\n` +
                `└ ID: \`${p.id}\` | Participantes: ${p.participants.length} | Host: <@${p.hostId}>`,
            )
            .join('\n\n');

          const listEmbed = interaction.client
            .baseEmbed()
            .setTitle('🎉 Festas Sincronizadas Ativas')
            .setDescription(partiesText)
            .setFooter({ text: 'Use /sync-party join para participar!' });

          await interaction.editReply({ embeds: [listEmbed] });
          break;
      }
    } catch (error) {
      console.error('Error with sync party:', error);
      await interaction.editReply({
        content:
          'Erro ao gerenciar festa sincronizada. Tente novamente mais tarde.',
      });
    }
  },
  cooldown: 5,
};
