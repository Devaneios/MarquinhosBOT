import { z } from 'zod';

export const gameIdSchema = z.enum([
  'pong',
  'wordle',
  'cards',
  'tic-tac-toe',
  'connect-four',
  'hangman',
  'battleship',
  'checkers',
  'rock-paper-scissors',
  'wordle-race',
  'minesweeper-versus',
  'trivia-quiz',
  'dominoes-block',
  'word-search-race',
  'bingo-speed',
  'tower-unstable',
  'boggle-word-race',
  'word-chain',
  'snake-game',
]);

export type GameId = z.infer<typeof gameIdSchema>;

export function isGameId(value: unknown): value is GameId {
  return gameIdSchema.safeParse(value).success;
}
