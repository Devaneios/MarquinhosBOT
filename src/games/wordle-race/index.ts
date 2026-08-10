import type { GameDescriptor } from '../registry';
import { wordleRaceRoutes } from './wordleRaceRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'wordle-race',
  status: 'PLAY',
  routes: wordleRaceRoutes,
};
