import type { GameDescriptor } from '../registry';
import { hangmanRoutes } from './hangmanRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'hangman',
  status: 'PLAY',
  routes: hangmanRoutes,
};
