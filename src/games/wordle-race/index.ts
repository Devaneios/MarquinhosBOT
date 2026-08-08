import type { GameDescriptor } from '../registry';
import { wordleRaceRoutes } from './wordleRaceRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'wordle-race',
  name: 'WORDLE RACE',
  status: 'PLAY',
  routes: wordleRaceRoutes,
};
