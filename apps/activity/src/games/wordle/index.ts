import type { GameDescriptor } from '@/games/GameDescriptor';
import { wordleRoutes } from './wordleRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'wordle',
  status: 'PLAY',
  routes: wordleRoutes,
};
