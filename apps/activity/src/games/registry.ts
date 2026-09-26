import { gameDescriptor as battleship } from '@/games/battleship';
import { gameDescriptor as bingoSpeed } from '@/games/bingo-speed';
import { gameDescriptor as boggleWordRace } from '@/games/boggle-word-race';
import { gameDescriptor as cards } from '@/games/cards';
import { gameDescriptor as checkers } from '@/games/checkers';
import { gameDescriptor as connectFour } from '@/games/connect-four';
import { gameDescriptor as dominoesBlock } from '@/games/dominoes-block';
import { gameDescriptor as hangman } from '@/games/hangman';
import { gameDescriptor as minesweeperVersus } from '@/games/minesweeper-versus';
import { gameDescriptor as pong } from '@/games/pong';
import { gameDescriptor as rockPaperScissors } from '@/games/rock-paper-scissors';
import { gameDescriptor as snakeGame } from '@/games/snake-game';
import { gameDescriptor as ticTacToe } from '@/games/tic-tac-toe';
import { gameDescriptor as towerUnstable } from '@/games/tower-unstable';
import { gameDescriptor as triviaQuiz } from '@/games/trivia-quiz';
import { gameDescriptor as wordChain } from '@/games/word-chain';
import { gameDescriptor as wordSearchRace } from '@/games/word-search-race';
import { gameDescriptor as wordle } from '@/games/wordle';
import { gameDescriptor as wordleRace } from '@/games/wordle-race';
import type { GameDescriptor } from './GameDescriptor';

// Adding a game means adding one descriptor file (see games/pong/index.ts,
// games/wordle/index.ts) and one entry here — Hub.tsx and routes.tsx never
// need to change.
export const GAME_REGISTRY: GameDescriptor[] = [
  cards,
  pong,
  wordle,
  ticTacToe,
  connectFour,
  hangman,
  battleship,
  checkers,
  rockPaperScissors,
  wordleRace,
  minesweeperVersus,
  triviaQuiz,
  dominoesBlock,
  wordSearchRace,
  bingoSpeed,
  towerUnstable,
  boggleWordRace,
  wordChain,
  snakeGame,
];
