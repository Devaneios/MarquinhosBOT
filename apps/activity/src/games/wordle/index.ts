import type { GameDescriptor } from '../registry';
import { wordleRoutes } from './wordleRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'wordle',
  status: 'PLAY',
  routes: wordleRoutes,
};
