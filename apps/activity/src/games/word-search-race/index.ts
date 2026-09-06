import type { GameDescriptor } from '../registry';
import { wordSearchRaceRoutes } from './wordSearchRaceRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'word-search-race',
  status: 'PLAY',
  routes: wordSearchRaceRoutes,
};
