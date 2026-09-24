import type { GameDescriptor } from '../GameDescriptor';
import { hangmanRoutes } from './hangmanRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'hangman',
  status: 'PLAY',
  routes: hangmanRoutes,
};
