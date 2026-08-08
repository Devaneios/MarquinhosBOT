import type { GameDescriptor } from '../registry';
import { hangmanRoutes } from './hangmanRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'hangman',
  name: 'HANGMAN',
  status: 'PLAY',
  routes: hangmanRoutes,
};
