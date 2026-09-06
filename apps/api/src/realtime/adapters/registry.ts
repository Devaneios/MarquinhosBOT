import type { GameId } from 'services/activity/gameId';
import type { GameRoomAdapter } from '../GameRoomAdapter';
import { battleshipAdapter } from './battleshipAdapter';
import { bingoSpeedAdapter } from './bingoSpeedAdapter';
import { boggleAdapter } from './boggleAdapter';
import { cardTableAdapter } from './cardTableAdapter';
import { checkersAdapter } from './checkersAdapter';
import { connectFourAdapter } from './connectFourAdapter';
import { dominoesAdapter } from './dominoesAdapter';
import { hangmanAdapter } from './hangmanAdapter';
import { minesweeperAdapter } from './minesweeperAdapter';
import { rpsAdapter } from './rpsAdapter';
import { snakeAdapter } from './snakeAdapter';
import { ticTacToeAdapter } from './ticTacToeAdapter';
import { towerUnstableAdapter } from './towerUnstableAdapter';
import { triviaQuizAdapter } from './triviaQuizAdapter';
import { wordChainAdapter } from './wordChainAdapter';
import { wordleAdapter } from './wordleAdapter';
import { wordleRaceAdapter } from './wordleRaceAdapter';
import { wordSearchRaceAdapter } from './wordSearchRaceAdapter';

export const ADAPTER_REGISTRY: Partial<
  Record<GameId, GameRoomAdapter<unknown>>
> = {
  hangman: hangmanAdapter,
  'tic-tac-toe': ticTacToeAdapter,
  'connect-four': connectFourAdapter,
  checkers: checkersAdapter,
  'rock-paper-scissors': rpsAdapter,
  battleship: battleshipAdapter,
  'bingo-speed': bingoSpeedAdapter,
  'boggle-word-race': boggleAdapter,
  cards: cardTableAdapter,
  'dominoes-block': dominoesAdapter,
  'minesweeper-versus': minesweeperAdapter,
  'snake-game': snakeAdapter,
  'tower-unstable': towerUnstableAdapter,
  'trivia-quiz': triviaQuizAdapter,
  'word-chain': wordChainAdapter,
  wordle: wordleAdapter,
  'wordle-race': wordleRaceAdapter,
  'word-search-race': wordSearchRaceAdapter,
};
