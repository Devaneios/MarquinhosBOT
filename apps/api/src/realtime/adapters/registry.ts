import type { GameId } from '@marquinhos/contracts/activity/gameId';
import type { GameRoomAdapter } from '../GameRoomAdapter';
import type { RoomDependencies } from '../room-dependencies';
import { battleshipAdapter } from './battleshipAdapter';
import { bingoSpeedAdapter } from './bingoSpeedAdapter';
import { boggleAdapter } from './boggleAdapter';
import { cardTableAdapter } from './cardTableAdapter';
import { checkersAdapter } from './checkersAdapter';
import { connectFourAdapter } from './connectFourAdapter';
import { dominoesAdapter } from './dominoesAdapter';
import { hangmanAdapter } from './hangmanAdapter';
import { minesweeperAdapter } from './minesweeperAdapter';
import { pongAdapter } from './pongAdapter';
import { rpsAdapter } from './rpsAdapter';
import { snakeAdapter } from './snakeAdapter';
import { ticTacToeAdapter } from './ticTacToeAdapter';
import { towerUnstableAdapter } from './towerUnstableAdapter';
import { triviaQuizAdapter } from './triviaQuizAdapter';
import { wordChainAdapter } from './wordChainAdapter';
import { wordleAdapter } from './wordleAdapter';
import { wordleRaceAdapter } from './wordleRaceAdapter';
import { wordSearchRaceAdapter } from './wordSearchRaceAdapter';

export function createAdapterRegistry(
  dependencies: RoomDependencies,
): Partial<Record<GameId, GameRoomAdapter<unknown>>> {
  const withDependencies = (
    adapter: GameRoomAdapter<unknown>,
  ): GameRoomAdapter<unknown> => ({
    ...adapter,
    setup: (context) => adapter.setup(context, dependencies),
  });

  return {
    hangman: withDependencies(hangmanAdapter),
    'tic-tac-toe': withDependencies(ticTacToeAdapter),
    'connect-four': withDependencies(connectFourAdapter),
    checkers: withDependencies(checkersAdapter),
    'rock-paper-scissors': withDependencies(rpsAdapter),
    battleship: withDependencies(battleshipAdapter),
    'bingo-speed': withDependencies(bingoSpeedAdapter),
    'boggle-word-race': withDependencies(boggleAdapter),
    cards: withDependencies(cardTableAdapter),
    'dominoes-block': withDependencies(dominoesAdapter),
    'minesweeper-versus': withDependencies(minesweeperAdapter),
    pong: withDependencies(pongAdapter),
    'snake-game': withDependencies(snakeAdapter),
    'tower-unstable': withDependencies(towerUnstableAdapter),
    'trivia-quiz': withDependencies(triviaQuizAdapter),
    'word-chain': withDependencies(wordChainAdapter),
    wordle: withDependencies(wordleAdapter),
    'wordle-race': withDependencies(wordleRaceAdapter),
    'word-search-race': withDependencies(wordSearchRaceAdapter),
  };
}
