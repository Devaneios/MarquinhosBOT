import type { GameDescriptor } from '@/games/GameDescriptor';
import { triviaQuizRoutes } from './triviaQuizRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'trivia-quiz',
  status: 'PLAY',
  routes: triviaQuizRoutes,
};
