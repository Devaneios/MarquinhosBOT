import type { GameDescriptor } from '@/games/GameDescriptor';
import { wordSearchRaceRoutes } from './wordSearchRaceRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'word-search-race',
  status: 'PLAY',
  routes: wordSearchRaceRoutes,
};
