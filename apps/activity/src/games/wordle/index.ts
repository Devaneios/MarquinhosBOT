import type { GameDescriptor } from '../GameDescriptor';
import { wordleRoutes } from './wordleRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'wordle',
  status: 'PLAY',
  routes: wordleRoutes,
};
