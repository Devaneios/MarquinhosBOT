import { lazyGame, type GameModule } from '@/games/GameModule';

export const wordSearchRaceGame = {
  id: 'word-search-race',
  status: 'PLAY',
  Game: lazyGame(() => import('./WordSearchRaceGame'), 'WordSearchRaceGame'),
} satisfies GameModule;
