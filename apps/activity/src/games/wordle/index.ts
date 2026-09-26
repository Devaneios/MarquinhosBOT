import { lazyGame, type GameModule } from '@/games/GameModule';

export const wordleGame = {
  id: 'wordle',
  status: 'PLAY',
  Game: lazyGame(() => import('./WordleGame'), 'WordleGame'),
} satisfies GameModule;
