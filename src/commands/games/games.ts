import { GameManager } from '@marquinhos/game/core/GameManager';
import {
  BaseGame,
  GameSession,
  GameType,
  PlayerStatus,
} from '@marquinhos/game/core/GameTypes';
import { GameUtils } from '@marquinhos/game/core/GameUtils';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

const apiService = MarquinhosApiService.getInstance();

import { BlackjackGame } from '@marquinhos/game/casino/blackjack';
import { DiceGame } from '@marquinhos/game/casino/dice';
import { LotteryGame } from '@marquinhos/game/casino/lottery';
import { RouletteGame } from '@marquinhos/game/casino/roulette';
import { SlotsGame } from '@marquinhos/game/casino/slots';
import { BrazilHistoryGame } from '@marquinhos/game/knowledge/brazilHistory';
import { GeographyGame } from '@marquinhos/game/knowledge/geography';
import { MusicQuizGame } from '@marquinhos/game/knowledge/musicQuiz';
import { PopCultureGame } from '@marquinhos/game/knowledge/popCulture';
import { BattleRoyaleGame } from '@marquinhos/game/multiplayer/battleRoyale';
import { SpeedMathGame } from '@marquinhos/game/multiplayer/speedMath';
import { MazeGame } from '@marquinhos/game/strategy/maze';
import { RockPaperScissorsGame } from '@marquinhos/game/strategy/rockPaperScissors';
import { SecretCodeGame } from '@marquinhos/game/strategy/secretCode';
import { TicTacToeGame } from '@marquinhos/game/strategy/ticTacToe';
import { AnagramGame } from '@marquinhos/game/words/anagram';
import { RhymeGame } from '@marquinhos/game/words/rhyme';
import { SecretWordGame } from '@marquinhos/game/words/secretWord';
import { TranslateGame } from '@marquinhos/game/words/translate';

const gameManager = GameManager.getInstance();

const GAME_TYPE_MAP: Record<string, GameType> = {
  slots: GameType.SLOTS,
  blackjack: GameType.BLACKJACK,
  dice: GameType.DICE,
  roulette: GameType.ROULETTE,
  lottery: GameType.LOTTERY,
  music_quiz: GameType.MUSIC_QUIZ,
  geography: GameType.GEOGRAPHY,
  pop_culture: GameType.POP_CULTURE,
  brazil_history: GameType.BRAZIL_HISTORY,
  secret_word: GameType.SECRET_WORD,
  anagram: GameType.ANAGRAM,
  rhyme: GameType.RHYME,
  translate: GameType.TRANSLATE,
  tic_tac_toe: GameType.TIC_TAC_TOE,
  secret_code: GameType.SECRET_CODE,
  rock_paper_scissors: GameType.ROCK_PAPER_SCISSORS,
  maze: GameType.MAZE,
  speed_math: GameType.SPEED_MATH,
  battle_royale: GameType.BATTLE_ROYALE,
};

const GAME_REGISTRY: Record<GameType, new (session: GameSession) => BaseGame> =
  {
    [GameType.SLOTS]: SlotsGame,
    [GameType.BLACKJACK]: BlackjackGame,
    [GameType.DICE]: DiceGame,
    [GameType.ROULETTE]: RouletteGame,
    [GameType.LOTTERY]: LotteryGame,
    [GameType.MUSIC_QUIZ]: MusicQuizGame,
    [GameType.GEOGRAPHY]: GeographyGame,
    [GameType.POP_CULTURE]: PopCultureGame,
    [GameType.BRAZIL_HISTORY]: BrazilHistoryGame,
    [GameType.SECRET_WORD]: SecretWordGame,
    [GameType.ANAGRAM]: AnagramGame,
    [GameType.RHYME]: RhymeGame,
    [GameType.TRANSLATE]: TranslateGame,
    [GameType.TIC_TAC_TOE]: TicTacToeGame,
    [GameType.SECRET_CODE]: SecretCodeGame,
    [GameType.ROCK_PAPER_SCISSORS]: RockPaperScissorsGame,
    [GameType.MAZE]: MazeGame,
    [GameType.SPEED_MATH]: SpeedMathGame,
    [GameType.BATTLE_ROYALE]: BattleRoyaleGame,
  };

export class GamesCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'games', cooldownDelay: 0 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription(
          'Central de jogos do Marquinhos - 20 mini games disponíveis!',
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
                  { name: '🎫 Loteria', value: 'lottery' },
                  { name: '🎵 Quiz Musical', value: 'music_quiz' },
                  { name: '🌍 Geografia', value: 'geography' },
                  { name: '📺 Cultura Pop', value: 'pop_culture' },
                  { name: '🇧🇷 História BR', value: 'brazil_history' },
                  { name: '🔤 Palavra Secreta', value: 'secret_word' },
                  { name: '🔀 Anagrama', value: 'anagram' },
                  { name: '🎤 Rima Rápida', value: 'rhyme' },
                  { name: '🌐 Traduzindo', value: 'translate' },
                  { name: '⭕ Jogo da Velha', value: 'tic_tac_toe' },
                  { name: '🔐 Código Secreto', value: 'secret_code' },
                  {
                    name: '✂️ Pedra, Papel, Tesoura',
                    value: 'rock_paper_scissors',
                  },
                  { name: '🏃 Labirinto', value: 'maze' },
                  { name: '➕ Speed Math', value: 'speed_math' },
                  { name: '⚔️ Battle Royale', value: 'battle_royale' },
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
    );
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case 'list':
        await showGameList(interaction);
        break;
      case 'play': {
        const gameType = interaction.options.getString('game', true);
        await startGame(interaction, gameType);
        break;
      }
      case 'stats':
        await showStats(interaction);
        break;
      case 'ranking':
        await showRanking(interaction);
        break;
    }
  }
}

async function showGameList(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🎮 Central de Jogos do Marquinhos')
    .setDescription('Escolha uma categoria e divirta-se!')
    .setColor(0x00ae86)
    .addFields(
      {
        name: '🎰 Cassino e Sorte',
        value:
          '🎰 Caça-níqueis\n🃏 Blackjack\n🎲 Dados Mágicos\n🔫 Roleta Russa\n🎫 Loteria',
        inline: true,
      },
      {
        name: '🧠 Conhecimento',
        value:
          '🎵 Quiz Musical\n🌍 Geografia Maluca\n📺 Cultura Pop\n🇧🇷 História do Brasil',
        inline: true,
      },
      {
        name: '📝 Palavras',
        value:
          '🔤 Palavra Secreta\n🔀 Anagrama Insano\n🎤 Rima Rápida\n🌐 Traduzindo',
        inline: true,
      },
      {
        name: '🧩 Estratégia',
        value:
          '⭕ Jogo da Velha\n🔐 Código Secreto\n✂️ Pedra, Papel, Tesoura\n🏃 Labirinto',
        inline: true,
      },
      {
        name: '🏆 Multiplayer',
        value: '➕ Speed Math\n⚔️ Battle Royale',
        inline: true,
      },
      {
        name: '🎯 Como Jogar',
        value:
          'Use `/games play` para escolher um jogo!\nCada jogo dá XP baseado na performance.',
        inline: false,
      },
    )
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('game_category_select')
    .setPlaceholder('Escolha uma categoria para ver os jogos')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🎰 Cassino e Sorte')
        .setValue('casino')
        .setDescription('Jogos de sorte e apostas')
        .setEmoji('🎰'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧠 Conhecimento')
        .setValue('knowledge')
        .setDescription('Teste seus conhecimentos')
        .setEmoji('🧠'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📝 Palavras')
        .setValue('words')
        .setDescription('Jogos com palavras e texto')
        .setEmoji('📝'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧩 Estratégia')
        .setValue('strategy')
        .setDescription('Jogos de lógica e estratégia')
        .setEmoji('🧩'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🏆 Multiplayer')
        .setValue('multiplayer')
        .setDescription('Jogos competitivos')
        .setEmoji('🏆'),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectMenu,
  );
  await interaction.reply({ embeds: [embed], components: [row] });
}

async function startGame(
  interaction: ChatInputCommandInteraction,
  gameKey: string,
) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const channelId = interaction.channelId;
  const gameType = GAME_TYPE_MAP[gameKey];

  if (!gameType) {
    await interaction.reply({
      content: 'Jogo não encontrado!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!gameManager.canUserPlay(userId, gameType)) {
    const cooldownRemaining = gameManager.getUserCooldownRemaining(
      userId,
      gameType,
    );
    await interaction.reply({
      content: `⏰ Você precisa aguardar ${GameUtils.formatCooldownTime(cooldownRemaining)} antes de jogar novamente.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const existingSession = gameManager.getPlayerSession(userId, guildId);
  if (existingSession) {
    await interaction.reply({
      content: '🎮 Você já está em um jogo! Termine o atual primeiro.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const channelSession = gameManager.getSessionByChannel(channelId);
  if (channelSession) {
    await interaction.reply({
      content: '🎮 Já há um jogo acontecendo neste canal!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const opponent = interaction.options.getUser('oponente');
  const multiplayerGames = [
    GameType.TIC_TAC_TOE,
    GameType.ROCK_PAPER_SCISSORS,
    GameType.SPEED_MATH,
    GameType.BATTLE_ROYALE,
  ];
  if (multiplayerGames.includes(gameType) && !opponent) {
    await interaction.reply({
      content:
        '👥 Este é um jogo multiplayer! Por favor, mencione um oponente usando a opção `oponente`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!multiplayerGames.includes(gameType) && opponent) {
    await interaction.reply({
      content:
        '❌ Este jogo é singleplayer, você não pode convidar um oponente.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (opponent && opponent.bot) {
    await interaction.reply({
      content: '❌ Você não pode jogar contra um bot!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (opponent && opponent.id === userId) {
    await interaction.reply({
      content: '❌ Você não pode jogar contra si mesmo!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (opponent) {
    const opponentSession = gameManager.getPlayerSession(opponent.id, guildId);
    if (opponentSession) {
      await interaction.reply({
        content:
          '🎮 Esse jogador já está em um jogo! Tente novamente mais tarde.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const session = gameManager.createSession(
    gameType,
    guildId,
    channelId,
    userId,
  );
  session.players.push({
    userId,
    username: interaction.user.username,
    score: 0,
    status: PlayerStatus.WAITING,
    joinedAt: new Date(),
  });
  if (opponent) {
    session.players.push({
      userId: opponent.id,
      username: opponent.username,
      score: 0,
      status: PlayerStatus.WAITING,
      joinedAt: new Date(),
    });
  }

  let gameInstance;
  try {
    const GameClass = GAME_REGISTRY[gameType];
    gameInstance = new GameClass(session);
    gameManager.registerGameInstance(session.id, gameInstance);
  } catch (_error) {
    await interaction.reply({
      content: '❌ Erro ao criar o jogo. Tente novamente.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  gameManager.setUserCooldown(userId, gameType);
  await gameInstance.start();

  const embed = gameInstance.getGameEmbed();
  const components = gameInstance.getComponents();
  await interaction.reply({ embeds: [embed], components });
}

async function showStats(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: 'Este comando só pode ser usado em servidores!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const response = await apiService.getUserGameStats(userId, guildId);
    const data = response?.data as {
      stats: { total_games: number; games_won: number };
      byGame: { game_type: string; games_played: number; wins: number }[];
    } | null;
    if (!data) {
      await interaction.editReply('Não foi possível buscar suas estatísticas.');
      return;
    }

    const { stats, byGame } = data;
    const winRate =
      stats.total_games > 0
        ? Math.round((stats.games_won / stats.total_games) * 100)
        : 0;
    const embed = new EmbedBuilder()
      .setTitle(`📊 Estatísticas de ${interaction.user.username}`)
      .setColor(0x3498db)
      .addFields(
        {
          name: '🎮 Jogos Jogados',
          value: stats.total_games.toString(),
          inline: true,
        },
        {
          name: '🏆 Vitórias',
          value: stats.games_won.toString(),
          inline: true,
        },
        { name: '📈 Taxa de Vitória', value: `${winRate}%`, inline: true },
      );
    if (byGame.length > 0) {
      const breakdown = byGame
        .slice(0, 8)
        .map(
          (g) =>
            `**${g.game_type}**: ${g.games_played} jogos, ${g.wins} vitórias`,
        )
        .join('\n');
      embed.addFields({ name: '🎯 Por Jogo', value: breakdown, inline: false });
    }
    await interaction.editReply({ embeds: [embed] });
  } catch (_error) {
    logger.error('Error fetching game stats:', _error);
    await interaction.editReply('Ocorreu um erro ao buscar suas estatísticas.');
  }
}

async function showRanking(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: 'Este comando só pode ser usado em servidores!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply();

  try {
    const response = await apiService.getLeaderboard(guildId, 10);
    if (!response?.data || response.data.length === 0) {
      await interaction.editReply('Nenhum jogador encontrado no ranking.');
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    let description = '';
    for (let i = 0; i < response.data.length; i++) {
      const entry = response.data[i]!;
      const medal = medals[i] ?? '🏅';
      try {
        const discordUser = await interaction.client.users.fetch(entry.userId);
        description += `${medal} **${i + 1}.** ${discordUser.username} — Nível ${entry.level} (${entry.totalXp} XP)\n`;
      } catch {
        description += `${medal} **${i + 1}.** Usuário desconhecido — Nível ${entry.level} (${entry.totalXp} XP)\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Ranking de ${interaction.guild?.name}`)
      .setDescription(description)
      .setColor(0xf39c12)
      .setFooter({ text: `Top ${response.data.length} jogadores` });
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error fetching ranking:', error);
    await interaction.editReply('Ocorreu um erro ao buscar o ranking.');
  }
}
