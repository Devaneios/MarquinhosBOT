import type { GameDescriptor } from '../registry';
import { wordSearchRaceRoutes } from './wordSearchRaceRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'word-search-race',
  name: 'WORD SEARCH RACE',
  status: 'PLAY',
  routes: wordSearchRaceRoutes,
};
