import type { JSX } from 'react';
import type { DiscordIdentity } from '../hooks/useDiscordIdentity';
import { gameDescriptor as battleship } from './battleship';
import { gameDescriptor as bingoSpeed } from './bingo-speed';
import { gameDescriptor as boggleWordRace } from './boggle-word-race';
import { gameDescriptor as cards } from './cards';
import { gameDescriptor as checkers } from './checkers';
import { gameDescriptor as connectFour } from './connect-four';
import { gameDescriptor as dominoesBlock } from './dominoes-block';
import type { GameId } from './gameId';
import { gameDescriptor as hangman } from './hangman';
import { gameDescriptor as minesweeperVersus } from './minesweeper-versus';
import { gameDescriptor as pong } from './pong';
import { gameDescriptor as rockPaperScissors } from './rock-paper-scissors';
import { gameDescriptor as snakeGame } from './snake-game';
import { gameDescriptor as ticTacToe } from './tic-tac-toe';
import { gameDescriptor as towerUnstable } from './tower-unstable';
import { gameDescriptor as triviaQuiz } from './trivia-quiz';
import { gameDescriptor as wordChain } from './word-chain';
import { gameDescriptor as wordSearchRace } from './word-search-race';
import { gameDescriptor as wordle } from './wordle';
import { gameDescriptor as wordleRace } from './wordle-race';

export interface GameDescriptor {
  id: GameId;
  status: 'PLAY' | 'COMING SOON';
  routes: (identity: DiscordIdentity, onAuthInvalid: () => void) => JSX.Element;
  // Renders this game's board inside a multiplayer Room view (see
  // src/rooms/RoomView.tsx) — reads room state via useRoomConnectionContext
  // rather than owning its own connection. Optional so this field can roll
  // out per-game: a room whose game has no renderRoomBoard yet falls back
  // to a "not available in rooms yet" message instead of breaking.
  renderRoomBoard?: (props: { identity: DiscordIdentity }) => JSX.Element;
}

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
