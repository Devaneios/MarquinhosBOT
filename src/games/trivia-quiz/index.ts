import type { GameDescriptor } from '../registry';
import { triviaQuizRoutes } from './triviaQuizRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'trivia-quiz',
  name: 'TRIVIA QUIZ',
  status: 'PLAY',
  routes: triviaQuizRoutes,
};
