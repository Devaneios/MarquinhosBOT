import { GameManager } from '@marquinhos/game/core/GameManager';
import { GameType } from '@marquinhos/game/core/GameTypes';
import { GameUtils } from '@marquinhos/game/core/GameUtils';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { SlashCommand } from '@marquinhos/types';
import { XPSystem } from '@marquinhos/utils/xpSystem';
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

const apiService = new MarquinhosApiService();

// Game implementations
import { BlackjackGame } from '@marquinhos/game/casino/blackjack';
import { DiceGame } from '@marquinhos/game/casino/dice';
import { LotteryGame } from '@marquinhos/game/casino/lottery';
import { RouletteGame } from '@marquinhos/game/casino/roulette';
import { SlotsGame } from '@marquinhos/game/casino/slots';

import { BrazilHistoryGame } from '@marquinhos/game/knowledge/brazilHistory';
import { GeographyGame } from '@marquinhos/game/knowledge/geography';
import { MusicQuizGame } from '@marquinhos/game/knowledge/musicQuiz';
import { PopCultureGame } from '@marquinhos/game/knowledge/popCulture';

import { AnagramGame } from '@marquinhos/game/words/anagram';
import { RhymeGame } from '@marquinhos/game/words/rhyme';
import { SecretWordGame } from '@marquinhos/game/words/secretWord';
import { TranslateGame } from '@marquinhos/game/words/translate';

import { MazeGame } from '@marquinhos/game/strategy/maze';
import { RockPaperScissorsGame } from '@marquinhos/game/strategy/rockPaperScissors';
import { SecretCodeGame } from '@marquinhos/game/strategy/secretCode';
import { TicTacToeGame } from '@marquinhos/game/strategy/ticTacToe';

import { BattleRoyaleGame } from '@marquinhos/game/multiplayer/battleRoyale';
import { SpeedMathGame } from '@marquinhos/game/multiplayer/speedMath';
import { TreasureHuntGame } from '@marquinhos/game/multiplayer/treasureHunt';

const gameManager = GameManager.getInstance();

export const games: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('games')
    .setDescription(
      'Central de jogos do Marquinhos - 20 mini games disponíveis!',
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('Ver todos os jogos disponíveis'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('play')
        .setDescription('Iniciar um jogo específico')
        .addStringOption((option) =>
          option
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
              { name: '🏃 Labirinto Mental', value: 'maze' },
              { name: '➕ Speed Math', value: 'speed_math' },
              { name: '⚔️ Battle Royale', value: 'battle_royale' },
              { name: '🗺️ Caça ao Tesouro', value: 'treasure_hunt' },
            ),
        )
        .addUserOption((option) =>
          option
            .setName('oponente')
            .setDescription('Marque um oponente para jogos multiplayer')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stats')
        .setDescription('Ver suas estatísticas de jogos'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ranking')
        .setDescription('Ver ranking dos melhores jogadores'),
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list':
        await showGameList(interaction);
        break;
      case 'play':
        const gameType = interaction.options.getString('game', true) as string;
        await startGame(interaction, gameType);
        break;
      case 'stats':
        await showStats(interaction);
        break;
      case 'ranking':
        await showRanking(interaction);
        break;
    }
  },
  cooldown: 5,
};

async function showGameList(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🎮 Central de Jogos do Marquinhos')
    .setDescription('Escolha uma categoria e divirta-se!')
    .setColor(0x00ae86)
    .addFields(
      {
        name: '🎰 Cassino e Sorte',
        value: `🎰 Caça-níqueis\n🃏 Blackjack\n🎲 Dados Mágicos\n🔫 Roleta Russa\n🎫 Loteria`,
        inline: true,
      },
      {
        name: '🧠 Conhecimento',
        value: `🎵 Quiz Musical\n🌍 Geografia Maluca\n📺 Cultura Pop\n🇧🇷 História do Brasil`,
        inline: true,
      },
      {
        name: '📝 Palavras',
        value: `🔤 Palavra Secreta\n🔀 Anagrama Insano\n🎤 Rima Rápida\n🌐 Traduzindo`,
        inline: true,
      },
      {
        name: '🧩 Estratégia',
        value: `⭕ Jogo da Velha\n🔐 Código Secreto\n✂️ Pedra, Papel, Tesoura\n🏃 Labirinto Mental`,
        inline: true,
      },
      {
        name: '🏆 Multiplayer',
        value: `➕ Speed Math\n⚔️ Battle Royale\n🗺️ Caça ao Tesouro`,
        inline: true,
      },
      {
        name: '🎯 Como Jogar',
        value: `Use \`/games play\` para escolher um jogo!\nCada jogo dá XP baseado na performance.`,
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

  await interaction.reply({
    embeds: [embed],
    components: [row],
  });
}

async function startGame(
  interaction: ChatInputCommandInteraction,
  gameKey: string,
) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const channelId = interaction.channelId;

  // Convert key to GameType
  const gameTypeMap: Record<string, GameType> = {
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
    treasure_hunt: GameType.TREASURE_HUNT,
  };

  const gameType = gameTypeMap[gameKey];
  if (!gameType) {
    await interaction.reply({
      content: 'Jogo não encontrado!',
      ephemeral: true,
    });
    return;
  }

  // Check cooldown
  if (!gameManager.canUserPlay(userId, gameType)) {
    const cooldownRemaining = gameManager.getUserCooldownRemaining(
      userId,
      gameType,
    );
    await interaction.reply({
      content: `⏰ Você precisa aguardar ${GameUtils.formatCooldownTime(cooldownRemaining)} antes de jogar novamente.`,
      ephemeral: true,
    });
    return;
  }

  // Check if user is already in a game
  const existingSession = gameManager.getPlayerSession(userId, guildId);
  if (existingSession) {
    await interaction.reply({
      content: '🎮 Você já está em um jogo! Termine o atual primeiro.',
      ephemeral: true,
    });
    return;
  }

  // Check if there's already a game in this channel
  const channelSession = gameManager.getSessionByChannel(channelId);
  if (channelSession) {
    await interaction.reply({
      content: '🎮 Já há um jogo acontecendo neste canal!',
      ephemeral: true,
    });
    return;
  }

  // Validate opponent/multiplayer before creating session to avoid orphaned sessions
  const opponent = interaction.options.getUser('oponente');

  const multiplayerGames = [
    GameType.TIC_TAC_TOE,
    GameType.ROCK_PAPER_SCISSORS,
    GameType.SPEED_MATH,
    GameType.BATTLE_ROYALE,
    GameType.TREASURE_HUNT,
  ];

  if (multiplayerGames.includes(gameType) && !opponent) {
    await interaction.reply({
      content:
        '👥 Este é um jogo multiplayer! Por favor, mencione um oponente usando a opção `oponente`.',
      ephemeral: true,
    });
    return;
  }

  if (!multiplayerGames.includes(gameType) && opponent) {
    await interaction.reply({
      content:
        '❌ Este jogo é singleplayer, você não pode convidar um oponente.',
      ephemeral: true,
    });
    return;
  }

  if (opponent && opponent.bot) {
    await interaction.reply({
      content: '❌ Você não pode jogar contra um bot!',
      ephemeral: true,
    });
    return;
  }

  if (opponent && opponent.id === userId) {
    await interaction.reply({
      content: '❌ Você não pode jogar contra si mesmo!',
      ephemeral: true,
    });
    return;
  }

  // Create game session
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
    status: 'waiting' as any,
    joinedAt: new Date(),
  });

  if (opponent) {
    session.players.push({
      userId: opponent.id,
      username: opponent.username,
      score: 0,
      status: 'waiting' as any,
      joinedAt: new Date(),
    });
  }

  // Create game instance
  let gameInstance;
  try {
    gameInstance = createGameInstance(gameType, session);
    gameManager.registerGameInstance(session.id, gameInstance);
  } catch (error) {
    await interaction.reply({
      content: '❌ Erro ao criar o jogo. Tente novamente.',
      ephemeral: true,
    });
    return;
  }

  // Set cooldown
  gameManager.setUserCooldown(userId, gameType);

  // Start the game
  await gameInstance.start();

  const embed = gameInstance.getGameEmbed();
  const components = getGameComponents(gameInstance);

  await interaction.reply({
    embeds: [embed],
    components,
  });

  // Add XP for starting a game
  await XPSystem.addCommandXP(interaction);
}

function createGameInstance(gameType: GameType, session: any) {
  switch (gameType) {
    case GameType.SLOTS:
      return new SlotsGame(session);
    case GameType.BLACKJACK:
      return new BlackjackGame(session);
    case GameType.DICE:
      return new DiceGame(session);
    case GameType.ROULETTE:
      return new RouletteGame(session);
    case GameType.LOTTERY:
      return new LotteryGame(session);
    case GameType.MUSIC_QUIZ:
      return new MusicQuizGame(session);
    case GameType.GEOGRAPHY:
      return new GeographyGame(session);
    case GameType.POP_CULTURE:
      return new PopCultureGame(session);
    case GameType.BRAZIL_HISTORY:
      return new BrazilHistoryGame(session);
    case GameType.SECRET_WORD:
      return new SecretWordGame(session);
    case GameType.ANAGRAM:
      return new AnagramGame(session);
    case GameType.RHYME:
      return new RhymeGame(session);
    case GameType.TRANSLATE:
      return new TranslateGame(session);
    case GameType.TIC_TAC_TOE:
      return new TicTacToeGame(session);
    case GameType.SECRET_CODE:
      return new SecretCodeGame(session);
    case GameType.ROCK_PAPER_SCISSORS:
      return new RockPaperScissorsGame(session);
    case GameType.MAZE:
      return new MazeGame(session);
    case GameType.SPEED_MATH:
      return new SpeedMathGame(session);
    case GameType.BATTLE_ROYALE:
      return new BattleRoyaleGame(session);
    case GameType.TREASURE_HUNT:
      return new TreasureHuntGame(session);
    default:
      throw new Error('Game type not implemented');
  }
}

function getGameComponents(gameInstance: any): any[] {
  const components: any[] = [];

  const buttonMethods = [
    'getActionButtons',
    'getAnswerButtons',
    'getChoiceButtons',
    'getBoardButtons',
    'getMovementButtons',
    'getBetButtons',
    'getLetterButtons',
    'getNumberButtons',
  ];

  for (const method of buttonMethods) {
    if (typeof gameInstance[method] === 'function') {
      const rows = gameInstance[method]();
      if (rows && rows.length > 0) {
        components.push(...rows);
      }
    }
  }

  // Discord allows a maximum of 5 action rows per message
  return components.slice(0, 5);
}

async function showStats(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      content: 'Este comando só pode ser usado em servidores!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

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
  } catch (error) {
    console.error('Error fetching game stats:', error);
    await interaction.editReply('Ocorreu um erro ao buscar suas estatísticas.');
  }
}

async function showRanking(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      content: 'Este comando só pode ser usado em servidores!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    // Show overall level leaderboard as the default ranking
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
    console.error('Error fetching ranking:', error);
    await interaction.editReply('Ocorreu um erro ao buscar o ranking.');
  }
}
