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

// 'multi' is the only mode where two connections share one match; 'single'
// (vs. the bot) and 'local' (hot-seat on one keyboard) are private to the
// user who opened them, which is what scopes their session key.
export const activityModeSchema = z.enum(['single', 'multi', 'local']);

export type ActivityMode = z.infer<typeof activityModeSchema>;

export function isGameId(value: unknown): value is GameId {
  return gameIdSchema.safeParse(value).success;
}
