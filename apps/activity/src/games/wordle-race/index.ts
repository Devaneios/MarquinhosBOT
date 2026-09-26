import type { GameDescriptor } from '@/games/GameDescriptor';
import { wordleRaceRoutes } from './wordleRaceRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'wordle-race',
  status: 'PLAY',
  routes: wordleRaceRoutes,
};
