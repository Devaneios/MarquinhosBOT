import { lazyGame, type GameModule } from '@/games/GameModule';

export const wordleRaceGame = {
  id: 'wordle-race',
  status: 'PLAY',
  Game: lazyGame(() => import('./WordleRaceGame'), 'WordleRaceGame'),
} satisfies GameModule;
