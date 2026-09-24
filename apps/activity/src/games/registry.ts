import type { GameDescriptor } from './GameDescriptor';
import { gameDescriptor as battleship } from './battleship/index';
import { gameDescriptor as bingoSpeed } from './bingo-speed/index';
import { gameDescriptor as boggleWordRace } from './boggle-word-race/index';
import { gameDescriptor as cards } from './cards/index';
import { gameDescriptor as checkers } from './checkers/index';
import { gameDescriptor as connectFour } from './connect-four/index';
import { gameDescriptor as dominoesBlock } from './dominoes-block/index';
import { gameDescriptor as hangman } from './hangman/index';
import { gameDescriptor as minesweeperVersus } from './minesweeper-versus/index';
import { gameDescriptor as pong } from './pong/index';
import { gameDescriptor as rockPaperScissors } from './rock-paper-scissors/index';
import { gameDescriptor as snakeGame } from './snake-game/index';
import { gameDescriptor as ticTacToe } from './tic-tac-toe/index';
import { gameDescriptor as towerUnstable } from './tower-unstable/index';
import { gameDescriptor as triviaQuiz } from './trivia-quiz/index';
import { gameDescriptor as wordChain } from './word-chain/index';
import { gameDescriptor as wordSearchRace } from './word-search-race/index';
import { gameDescriptor as wordleRace } from './wordle-race/index';
import { gameDescriptor as wordle } from './wordle/index';

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
