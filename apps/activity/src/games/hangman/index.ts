import { lazyGame, type GameModule } from '@/games/GameModule';

export const hangmanGame = {
  id: 'hangman',
  status: 'PLAY',
  Game: lazyGame(() => import('./HangmanGame'), 'HangmanGame'),
} satisfies GameModule;
