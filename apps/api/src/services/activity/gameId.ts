export type GameId =
  | 'pong'
  | 'wordle'
  | 'cards'
  | 'tic-tac-toe'
  | 'connect-four'
  | 'hangman'
  | 'battleship'
  | 'checkers'
  | 'rock-paper-scissors'
  | 'wordle-race'
  | 'minesweeper-versus'
  | 'trivia-quiz'
  | 'dominoes-block'
  | 'word-search-race'
  | 'bingo-speed'
  | 'tower-unstable'
  | 'boggle-word-race'
  | 'word-chain'
  | 'snake-game';

// 'multi' is the only mode where two connections share one match; 'single'
// (vs. the bot) and 'local' (hot-seat on one keyboard) are private to the
// user who opened them, which is what scopes their session key.
export type ActivityMode = 'single' | 'multi' | 'local';

const GAME_IDS: readonly GameId[] = [
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
];

export function isGameId(value: unknown): value is GameId {
  return GAME_IDS.includes(value as GameId);
}
