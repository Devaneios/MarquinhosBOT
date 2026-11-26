import type { Command } from '@sapphire/framework';
import {
  ChannelType,
  PermissionFlagsBits,
  PermissionsBitField,
  type SlashCommandBuilder,
} from 'discord.js';
import { readdirSync } from 'node:fs';
import { resourcePath } from '../utils/resources';

export interface CommandDefinition {
  source: string;
  options: Command.Options & { name: string };
  build: (
    builder: SlashCommandBuilder,
    name: string,
    audioDirectory?: string,
  ) => unknown;
}

const EMBED_DESCRIPTION_MAX_LENGTH = 4096;

function audioChoices(directory = resourcePath('sounds')) {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.mp3') && !file.startsWith('_'))
    .map((file) => file.slice(0, -4));
}

/**
 * Metadata used by Sapphire and the offline command reference. Each definition
 * builds the same Discord payload in both callers, with an explicit name so the
 * development bot can prefix it. Building needs no Discord session. The audio
 * builder reads local assets and throws if its sounds directory cannot be read.
 * Registration still depends on the entries loaded by registerSapphireCommands.
 */
export const commandDefinitions = {
  admin: {
    source: 'commands/admin/admin.ts',
    options: { name: 'admin', cooldownDelay: 5_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Comandos administrativos')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
          sub
            .setName('status')
            .setDescription(
              'Mostra o status atual do bot (API, sessões, erros, uptime)',
            ),
        )
        .addSubcommandGroup((group) =>
          group
            .setName('termo')
            .setDescription('Gerenciar o jogo Termo')
            .addSubcommand((sub) =>
              sub
                .setName('novo')
                .setDescription(
                  'Força uma nova palavra para o Termo (uso em testes)',
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('canal')
                .setDescription(
                  'Define o canal onde o Termo envia mensagens públicas',
                )
                .addChannelOption((opt) =>
                  opt
                    .setName('canal')
                    .setDescription('Canal de texto para o Termo')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('status')
                .setDescription(
                  'Envia o status de hoje no canal do Termo (sem revelar a palavra)',
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('leaderboard')
                .setDescription('Veja o ranking do Terminhos')
                .addStringOption((opt) =>
                  opt
                    .setName('periodo')
                    .setDescription('Período do ranking')
                    .setRequired(true)
                    .addChoices(
                      { name: 'Hoje', value: 'daily' },
                      { name: 'Esta semana', value: 'weekly' },
                      { name: 'Este mês', value: 'monthly' },
                      { name: 'Histórico', value: 'all-time' },
                    ),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('meta')
                .setDescription('Agenda uma meta coletiva para o Terminhos')
                .addIntegerOption((opt) =>
                  opt
                    .setName('alvo')
                    .setDescription('Participações distintas necessárias')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(100000),
                )
                .addStringOption((opt) =>
                  opt
                    .setName('inicio')
                    .setDescription('Primeiro dia, AAAA-MM-DD (Recife)')
                    .setRequired(true),
                )
                .addStringOption((opt) =>
                  opt
                    .setName('fim')
                    .setDescription('Último dia, AAAA-MM-DD (Recife)')
                    .setRequired(true),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('anuncios')
                .setDescription('Configura anúncios comunitários do Terminhos')
                .addBooleanOption((opt) =>
                  opt
                    .setName('coletivo')
                    .setDescription('Anunciar páginas e metas concluídas')
                    .setRequired(true),
                )
                .addBooleanOption((opt) =>
                  opt
                    .setName('resumo')
                    .setDescription('Publicar resumo e galeria semanais')
                    .setRequired(true),
                )
                .addChannelOption((opt) =>
                  opt
                    .setName('canal')
                    .setDescription(
                      'Canal de anúncios; omita para manter pendentes',
                    )
                    .addChannelTypes(ChannelType.GuildText),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('incertos')
                .setDescription('Lista anúncios que precisam de conferência'),
            )
            .addSubcommand((sub) =>
              sub
                .setName('conciliar')
                .setDescription(
                  'Registra o resultado da conferência de um anúncio',
                )
                .addStringOption((opt) =>
                  opt
                    .setName('id')
                    .setDescription('ID do anúncio listado em incertos')
                    .setRequired(true),
                )
                .addStringOption((opt) =>
                  opt
                    .setName('resultado')
                    .setDescription('Confirme após verificar o canal')
                    .setRequired(true)
                    .addChoices(
                      { name: 'Mensagem encontrada', value: 'found' },
                      {
                        name: 'Confirmado que não foi enviada',
                        value: 'confirmed_absent',
                      },
                    ),
                )
                .addStringOption((opt) =>
                  opt
                    .setName('mensagem')
                    .setDescription('ID da mensagem encontrada, quando houver'),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('bingo')
                .setDescription('Agenda uma cartela comunitária de bingo')
                .addStringOption((opt) =>
                  opt
                    .setName('inicio')
                    .setDescription('Primeiro dia, AAAA-MM-DD (Recife)')
                    .setRequired(true),
                )
                .addStringOption((opt) =>
                  opt
                    .setName('fim')
                    .setDescription('Último dia, AAAA-MM-DD (Recife)')
                    .setRequired(true),
                )
                .addBooleanOption((opt) =>
                  opt
                    .setName('multiplas')
                    .setDescription('Uma ação pode preencher várias casas?')
                    .setRequired(true),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('conversa')
                .setDescription(
                  'Inicia uma conversa sobre uma partida encerrada',
                )
                .addStringOption((opt) =>
                  opt
                    .setName('dia')
                    .setDescription('Data da partida encerrada, AAAA-MM-DD')
                    .setRequired(true),
                ),
            ),
        )
        .addSubcommandGroup((group) =>
          group
            .setName('wordlist')
            .setDescription('Gerenciar a wordlist do Termo')
            .addSubcommand((sub) =>
              sub
                .setName('review')
                .setDescription(
                  'Revisa a próxima palavra pendente da wordlist.txt',
                ),
            ),
        ),
  },
  chaos: {
    source: 'commands/admin/chaos.ts',
    options: { name: 'chaos', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Instaura o CHAOS nos canais de voz')
        .setDefaultMemberPermissions(0)
        .addStringOption((option) =>
          option
            .setName('nivel_do_chaos')
            .setDescription('O quão caótico você precisa que fique.')
            .setRequired(false),
        ),
  },
  ia: {
    source: 'commands/ai/ia.ts',
    options: { name: 'ia', cooldownDelay: 0 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Fala com a IA do Marquinhos numa thread dedicada')
        .addSubcommand((sub) =>
          sub
            .setName('perguntar')
            .setDescription(
              'Abre uma thread e responde sua pergunta, mantendo o contexto da conversa',
            )
            .addStringOption((opt) =>
              opt
                .setName('pergunta')
                .setDescription('O que você quer saber')
                .setRequired(true)
                .setMaxLength(1000),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('pesquisar')
            .setDescription(
              'Pesquisa profunda: busca na web, lê as páginas e entrega um relatório com fontes',
            )
            .addStringOption((opt) =>
              opt
                .setName('tema')
                .setDescription('O tema que você quer que eu pesquise')
                .setRequired(true)
                .setMaxLength(500),
            ),
        ),
  },
  apistatus: {
    source: 'commands/dev/apistatus.ts',
    options: { name: 'apistatus', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Checks whether the Marquinhos API is available'),
  },
  games: {
    source: 'commands/games/games.ts',
    options: { name: 'games', cooldownDelay: 0 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription(
          'Central de jogos do Marquinhos - 7 mini games disponíveis!',
        )
        .addSubcommand((sub) =>
          sub.setName('list').setDescription('Ver todos os jogos disponíveis'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('play')
            .setDescription('Iniciar um jogo específico')
            .addStringOption((opt) =>
              opt
                .setName('game')
                .setDescription('Escolha o jogo')
                .setRequired(true)
                .addChoices(
                  { name: '🎰 Caça-níqueis', value: 'slots' },
                  { name: '🃏 Blackjack', value: 'blackjack' },
                  { name: '🎲 Dados Mágicos', value: 'dice' },
                  { name: '🔫 Roleta Russa', value: 'roulette' },
                  { name: '⭕ Jogo da Velha', value: 'tic_tac_toe' },
                  {
                    name: '✂️ Pedra, Papel, Tesoura',
                    value: 'rock_paper_scissors',
                  },
                  { name: '🏃 Labirinto', value: 'maze' },
                ),
            )
            .addUserOption((opt) =>
              opt
                .setName('oponente')
                .setDescription('Marque um oponente para jogos multiplayer')
                .setRequired(false),
            ),
        )
        .addSubcommand((sub) =>
          sub.setName('stats').setDescription('Ver suas estatísticas de jogos'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('ranking')
            .setDescription('Ver ranking dos melhores jogadores'),
        ),
  },
  termo: {
    source: 'commands/games/termo.ts',
    options: { name: 'termo', cooldownDelay: 3_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Jogue o Terminhos, o Termo do Marquinhos!')
        .addStringOption((opt) =>
          opt
            .setName('palpite')
            .setDescription('Sua tentativa')
            .setAutocomplete(true),
        ),
  },
  'termo-conquistas': {
    source: 'commands/games/termoAchievements.ts',
    options: { name: 'termo-conquistas', cooldownDelay: 5_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Veja as conquistas e estatísticas do Terminhos')
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setDescription('Pessoa para ver as conquistas (opcional)')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('conquista')
            .setDescription(
              'Nome ou ID da conquista para ver o desenho e os detalhes',
            )
            .setRequired(false),
        ),
  },
  'termo-compartilhar': {
    source: 'commands/games/termoCompartilhar.ts',
    options: { name: 'termo-compartilhar', cooldownDelay: 5000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Prévia para compartilhar uma conquista do Terminhos')
        .addStringOption((option) =>
          option
            .setName('conquista')
            .setDescription('Nome ou ID de uma conquista desbloqueada')
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal onde publicar após confirmar')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
  },
  anom: {
    source: 'commands/general/anom.ts',
    options: { name: 'anom', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription(
          'Envio uma mensagem em anônimo pra um canal. (Quase) Ninguém vai saber quem deixou a mensagem.',
        )
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal que você quer que eu envie a mensagem')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((option) =>
          option
            .setName('mensagem')
            .setDescription('O que você quer que eu envie')
            .setRequired(true)
            .setMaxLength(EMBED_DESCRIPTION_MAX_LENGTH),
        ),
  },
  avatar: {
    source: 'commands/general/avatar.ts',
    options: { name: 'avatar', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Gerencia o avatar do bot')
        .setDefaultMemberPermissions(0)
        .addSubcommand((subcommand) =>
          subcommand
            .setName('listar')
            .setDescription('Lista todos os avatares disponíveis'),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('selecionar')
            .setDescription('Seleciona um avatar específico')
            .addStringOption((option) =>
              option
                .setName('nome')
                .setDescription('O nome do avatar')
                .setRequired(true)
                .setAutocomplete(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('feriado')
            .setDescription('Atualiza para o avatar de feriado atual'),
        ),
  },
  gato: {
    source: 'commands/general/cat.ts',
    options: { name: 'gato', cooldownDelay: 10_000 },
    build: (builder, name) => builder.setName(name).setDescription('GATO'),
  },
  moeda: {
    source: 'commands/general/coin.ts',
    options: { name: 'moeda', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Tiro cara ou coroa numa moeda semi-viciada.'),
  },
  olavac: {
    source: 'commands/general/esroh.ts',
    options: { name: 'olavac', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder.setName(name).setDescription('Oirártnoc?'),
  },
  cavalo: {
    source: 'commands/general/horse.ts',
    options: { name: 'cavalo', cooldownDelay: 10_000 },
    build: (builder, name) => builder.setName(name).setDescription('CAVALO'),
  },
  ping: {
    source: 'commands/general/ping.ts',
    options: { name: 'ping', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder.setName(name).setDescription("Shows the bot's ping"),
  },
  horario: {
    source: 'commands/general/time.ts',
    options: { name: 'horario', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Eu te digo que horas são. Só isso.....'),
  },
  audio: {
    source: 'commands/music/audio.ts',
    options: { name: 'audio', cooldownDelay: 10_000 },
    build: (builder, name, audioDirectory) =>
      builder
        .setName(name)
        .setDescription('Reproduz um áudio')
        .addStringOption((option) =>
          option
            .setName('audio')
            .setDescription('Áudio a ser reproduzido')
            .setRequired(true)
            .addChoices(
              ...audioChoices(audioDirectory).map((a) => ({
                name: a,
                value: a,
              })),
            ),
        ),
  },
  'limpar-fila': {
    source: 'commands/music/clearQueue.ts',
    options: {
      name: 'limpar-fila',
      preconditions: ['UserInVoiceChannel'],
    },
    build: (builder, name) =>
      builder.setName(name).setDescription('Mostra a fila de músicas'),
  },
  desconectar: {
    source: 'commands/music/disconnect.ts',
    options: { name: 'desconectar', cooldownDelay: 5_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Remove uma pessoa específica do canal de voz')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers)
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setDescription('O usuário que será desconectado')
            .setRequired(true),
        ),
  },
  'encerrar-chamada': {
    source: 'commands/music/disconnectAll.ts',
    options: { name: 'encerrar-chamada', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Remove todo mundo da chamada atual')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers),
  },
  lastfm: {
    source: 'commands/music/lastfm.ts',
    options: { name: 'lastfm', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Mostra informações sobre a integração com o last.fm'),
  },
  'mover-todos': {
    source: 'commands/music/moveAll.ts',
    options: { name: 'mover-todos', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Move todos do canal pra o canal escolhido')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers)
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal escolhido para os membros serem movidos')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice),
        ),
  },
  play: {
    source: 'commands/music/play.ts',
    options: {
      name: 'play',
      preconditions: [
        'UserInVoiceChannel',
        'BotNotInOtherChannel',
        'CanSpeak',
        'CanJoin',
      ],
    },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Toca uma música')
        .addStringOption((option) =>
          option
            .setName('musica')
            .setDescription('A música a ser tocada')
            .setRequired(true),
        ),
  },
  'adicionar-a-fila': {
    source: 'commands/music/playNext.ts',
    options: {
      name: 'adicionar-a-fila',
      preconditions: [
        'UserInVoiceChannel',
        'BotNotInOtherChannel',
        'CanSpeak',
        'CanJoin',
      ],
    },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Adiciona uma música ao topo da fila')
        .addStringOption((option) =>
          option
            .setName('musica')
            .setDescription('A música a ser tocada')
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option
            .setName('posicao')
            .setDescription('A posição que a música deve ser adicionada'),
        ),
  },
  fila: {
    source: 'commands/music/queue.ts',
    options: {
      name: 'fila',
      preconditions: ['BotNotInOtherChannel'],
    },
    build: (builder, name) =>
      builder.setName(name).setDescription('Mostra a fila de músicas'),
  },
  pular: {
    source: 'commands/music/skip.ts',
    options: {
      name: 'pular',
      preconditions: ['UserInVoiceChannel', 'BotNotInOtherChannel'],
    },
    build: (builder, name) =>
      builder.setName(name).setDescription('Pula a música atual'),
  },
  'check-in': {
    source: 'commands/social/checkIn.ts',
    options: { name: 'check-in', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Receba um carimbo no seu passaporte do servidor!'),
  },
  importunar: {
    source: 'commands/social/importunate.ts',
    options: { name: 'importunar', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription(
          'Eu vou lá no canal de voz atazanar a vida de quem tu quiser.',
        )
        .addUserOption((option) =>
          option
            .setName('importunado')
            .setDescription('Quem você quer que eu irrite?')
            .setRequired(true),
        ),
  },
  leaderboard: {
    source: 'commands/social/leaderboard.ts',
    options: { name: 'leaderboard', cooldownDelay: 30_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Mostra o ranking de níveis do servidor')
        .addIntegerOption((option) =>
          option
            .setName('limite')
            .setDescription('Número de usuários para mostrar (padrão: 10)')
            .setMinValue(5)
            .setMaxValue(25)
            .setRequired(false),
        ),
  },
  level: {
    source: 'commands/social/level.ts',
    options: { name: 'level', cooldownDelay: 10_000 },
    build: (builder, name) =>
      builder
        .setName(name)
        .setDescription('Mostra seu nível e XP atual')
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setDescription('Usuário para verificar o nível (opcional)')
            .setRequired(false),
        ),
  },
} satisfies Record<string, CommandDefinition>;
