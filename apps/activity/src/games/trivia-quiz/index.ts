import type { GameDescriptor } from '../GameDescriptor';
import { triviaQuizRoutes } from './triviaQuizRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'trivia-quiz',
  status: 'PLAY',
  routes: triviaQuizRoutes,
};
