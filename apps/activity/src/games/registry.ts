import { battleshipGame } from '@/games/battleship';
import { bingoSpeedGame } from '@/games/bingo-speed';
import { boggleWordRaceGame } from '@/games/boggle-word-race';
import { cardsGame } from '@/games/cards';
import { checkersGame } from '@/games/checkers';
import { connectFourGame } from '@/games/connect-four';
import { dominoesBlockGame } from '@/games/dominoes-block';
import { hangmanGame } from '@/games/hangman';
import { minesweeperVersusGame } from '@/games/minesweeper-versus';
import { pongGame } from '@/games/pong';
import { rockPaperScissorsGame } from '@/games/rock-paper-scissors';
import { snakeGame } from '@/games/snake-game';
import { ticTacToeGame } from '@/games/tic-tac-toe';
import { towerUnstableGame } from '@/games/tower-unstable';
import { triviaQuizGame } from '@/games/trivia-quiz';
import { wordChainGame } from '@/games/word-chain';
import { wordSearchRaceGame } from '@/games/word-search-race';
import { wordleGame } from '@/games/wordle';
import { wordleRaceGame } from '@/games/wordle-race';
import type { GameModule } from './GameModule';

export const GAME_REGISTRY: GameModule[] = [
  cardsGame,
  pongGame,
  wordleGame,
  ticTacToeGame,
  connectFourGame,
  hangmanGame,
  battleshipGame,
  checkersGame,
  rockPaperScissorsGame,
  wordleRaceGame,
  minesweeperVersusGame,
  triviaQuizGame,
  dominoesBlockGame,
  wordSearchRaceGame,
  bingoSpeedGame,
  towerUnstableGame,
  boggleWordRaceGame,
  wordChainGame,
  snakeGame,
];
