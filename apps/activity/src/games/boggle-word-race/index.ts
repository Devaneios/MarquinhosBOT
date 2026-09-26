import { lazyGame, type GameModule } from '@/games/GameModule';

export const boggleWordRaceGame = {
  id: 'boggle-word-race',
  status: 'PLAY',
  Game: lazyGame(() => import('./BoggleGame'), 'BoggleGame'),
} satisfies GameModule;
